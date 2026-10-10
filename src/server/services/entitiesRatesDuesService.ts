import {
  AppError,
  JwtClaims,
  Money,
  normalizeVehicleRegistration,
  isValidIndianMobile,
} from '../infra/core';
import { IDataStore } from '../repositories/interfaces';
import {
  hasWardJurisdiction,
  assertCitizenEntityOwnership,
} from '../middleware/authMiddleware';
import { appendAudit } from './authAndUsersService';
import {
  MunicipalEntity,
  EntityCategory,
  RateMaster,
  DueRecord,
  DueAdjustment,
  GovVerificationStatus,
} from '../../types/suvidha';

export class EntitiesRatesDuesService {
  constructor(private readonly store: IDataStore) {}

  public async listCategories(): Promise<EntityCategory[]> {
    const db = await this.store.readAll();
    return db.categories;
  }

  public async createCategory(
    actor: JwtClaims,
    payload: {
      code: string;
      name: string;
      entityType: 'VEHICLE' | 'VENDOR';
      specificFields: string[];
      applicableFeeTypes: string[];
      activeRateAmount: number;
    },
    correlationId: string
  ): Promise<EntityCategory> {
    return this.store.withTransaction('CREATE_CATEGORY', (db) => {
      if (
        db.categories.some(
          (c) => c.code.toUpperCase() === payload.code.toUpperCase()
        )
      ) {
        throw new AppError(409, 'DUPLICATE_CATEGORY', 'Category code already exists');
      }
      const cat: EntityCategory = {
        id: `CAT-${payload.code.slice(0, 5).toUpperCase()}-${db.categories.length + 1}`,
        code: payload.code.toUpperCase(),
        name: payload.name,
        entityType: payload.entityType,
        specificFields: payload.specificFields,
        applicableFeeTypes: payload.applicableFeeTypes,
        activeRateId: `RT-2026-0${db.rates.length + 1}`,
        activeRateAmount: payload.activeRateAmount,
        entitiesCount: 0,
        status: 'ACTIVE',
      };
      db.categories.push(cat);
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMIN_CREATED_CATEGORY',
        module: 'CATEGORY_MASTER',
        entityType: 'CATEGORY',
        entityId: cat.id,
        previousValueSummary: 'None',
        newValueSummary: `Created category ${cat.name} (${cat.code})`,
        correlationId,
      });
      return cat;
    });
  }

  public async listEntities(
    actor: JwtClaims,
    filters: {
      q?: string;
      entityType?: string;
      wardId?: string;
      categoryId?: string;
      status?: string;
    }
  ): Promise<MunicipalEntity[]> {
    const db = await this.store.readAll();
    let list = db.entities;

    // Citizen isolation: only own entities
    if (actor.role === 'CITIZEN') {
      const linked = actor.linkedEntityIds || [];
      list = list.filter(
        (e) => linked.includes(e.id) || e.mobile === actor.loginIdentifier
      );
    }

    if (filters.entityType && filters.entityType !== 'ALL') {
      list = list.filter((e) => e.entityType === filters.entityType);
    }
    if (filters.wardId && filters.wardId !== 'ALL') {
      list = list.filter(
        (e) =>
          e.wardId.toUpperCase() === filters.wardId!.toUpperCase() ||
          e.wardName.toUpperCase().includes(filters.wardId!.toUpperCase())
      );
    }
    if (filters.categoryId && filters.categoryId !== 'ALL') {
      list = list.filter((e) => e.categoryId === filters.categoryId);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((e) => e.registrationStatus === filters.status);
    }
    if (filters.q && filters.q.trim() !== '') {
      const rawQ = filters.q.trim().toLowerCase();
      const normQ = normalizeVehicleRegistration(filters.q);
      list = list.filter((e) => {
        const matchDirect =
          (normQ.length > 0 && e.normalizedIdentifier.includes(normQ)) ||
          e.name.toLowerCase().includes(rawQ) ||
          e.mobile.includes(rawQ) ||
          e.id.toLowerCase().includes(rawQ);
        if (matchDirect) return true;

        // Also support search by receipt number or payment reference (Module H)
        const matchReceipt = db.receipts.some(
          (r) =>
            r.entityId === e.id && r.receiptNumber.toLowerCase().includes(rawQ)
        );
        const matchPayment = db.payments.some(
          (p) =>
            p.entityId === e.id &&
            (p.referenceNumber.toLowerCase().includes(rawQ) ||
              p.id.toLowerCase().includes(rawQ))
        );
        return matchReceipt || matchPayment;
      });
    }

    return list;
  }

  public async getEntityById(actor: JwtClaims, id: string): Promise<MunicipalEntity> {
    const db = await this.store.readAll();
    const entity = db.entities.find((e) => e.id === id);
    if (!entity) {
      throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity ${id} was not found`);
    }
    assertCitizenEntityOwnership(actor, entity.id, entity.mobile);
    return entity;
  }

  public async createEntity(
    actor: JwtClaims,
    payload: {
      registrationNumber: string;
      entityType: 'VEHICLE' | 'VENDOR';
      name: string;
      mobile: string;
      address: string;
      categoryId: string;
      vehicleType?: string;
      stallLocation?: string;
      wardId: string;
      saveAsDraft?: boolean;
    },
    correlationId: string
  ): Promise<MunicipalEntity> {
    if (!isValidIndianMobile(payload.mobile)) {
      throw new AppError(
        400,
        'INVALID_MOBILE_NUMBER',
        'Mobile number must be a valid 10-digit Indian mobile number'
      );
    }

    return this.store.withTransaction('CREATE_ENTITY', (db) => {
      const normalized = normalizeVehicleRegistration(payload.registrationNumber);
      const duplicate = db.entities.find(
        (e) => e.normalizedIdentifier === normalized
      );
      if (duplicate) {
        throw new AppError(
          409,
          'DUPLICATE_REGISTRATION',
          `Registration number ${payload.registrationNumber} (normalized: ${normalized}) is already registered under Entity ${duplicate.id}`
        );
      }

      const ward = db.wards.find(
        (w) =>
          w.id.toUpperCase() === payload.wardId.toUpperCase() ||
          w.code.toUpperCase() === payload.wardId.toUpperCase()
      );
      if (!ward) {
        throw new AppError(404, 'WARD_NOT_FOUND', `Ward ${payload.wardId} not found`);
      }

      if (!hasWardJurisdiction(actor, ward.code, db.wards)) {
        throw new AppError(
          403,
          'JURISDICTION_FORBIDDEN',
          `Actor ${actor.loginIdentifier} does not have jurisdiction in Ward ${ward.code}`
        );
      }

      const category =
        db.categories.find((c) => c.id === payload.categoryId) || db.categories[0];

      const newEntity: MunicipalEntity = {
        id: `ENT-${1000 + db.entities.length + 1}`,
        registrationNumber: payload.registrationNumber.trim().toUpperCase(),
        normalizedIdentifier: normalized,
        entityType: payload.entityType,
        name: payload.name.trim(),
        mobile: payload.mobile.trim(),
        address: payload.address.trim(),
        category: category.name,
        categoryId: category.id,
        vehicleType: payload.vehicleType,
        stallLocation: payload.stallLocation,
        wardId: ward.id,
        wardName: ward.name,
        zoneName: ward.zoneName,
        registrationDate: new Date().toISOString().slice(0, 10),
        previousOutstanding: 0,
        newCharges: 0,
        adjustmentsTotal: 0,
        waiversTotal: 0,
        paidAllocated: 0,
        outstandingAmount: 0,
        registrationStatus: payload.saveAsDraft ? 'DRAFT' : 'SUBMITTED',
        govVerificationStatus: 'PENDING',
        govVerificationRef: `VAHAN-PENDING-${Date.now().toString().slice(-5)}`,
        govLastChecked: new Date().toISOString(),
      };

      db.entities.unshift(newEntity);
      ward.registeredEntitiesCount += 1;
      category.entitiesCount += 1;

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action:
          payload.entityType === 'VEHICLE'
            ? 'AGENTCREATEDVEHICLE'
            : 'AGENT_CREATED_VENDOR',
        module: 'ENTITY_REGISTRATION',
        entityType: payload.entityType,
        entityId: newEntity.id,
        previousValueSummary: 'None',
        newValueSummary: `Registered ${newEntity.registrationNumber} (${newEntity.registrationStatus}) in ${ward.code}`,
        correlationId,
      });

      return newEntity;
    });
  }

  public async updateEntity(
    actor: JwtClaims,
    id: string,
    payload: Partial<{
      name: string;
      mobile: string;
      address: string;
      vehicleType: string;
      stallLocation: string;
      wardId: string;
    }>,
    correlationId: string
  ): Promise<MunicipalEntity> {
    return this.store.withTransaction('UPDATE_ENTITY', (db) => {
      const entity = db.entities.find((e) => e.id === id);
      if (!entity) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity ${id} was not found`);
      }
      if (!hasWardJurisdiction(actor, entity.wardId, db.wards)) {
        throw new AppError(
          403,
          'JURISDICTION_FORBIDDEN',
          `Actor is not authorized for ward ${entity.wardId}`
        );
      }
      const prev = `${entity.name} | ${entity.mobile}`;
      Object.assign(entity, payload);
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ENTITY_UPDATED',
        module: 'ENTITY_REGISTRATION',
        entityType: entity.entityType,
        entityId: entity.id,
        previousValueSummary: prev,
        newValueSummary: `${entity.name} | ${entity.mobile}`,
        correlationId,
      });
      return entity;
    });
  }

  public async submitRegistration(
    actor: JwtClaims,
    id: string,
    correlationId: string
  ): Promise<MunicipalEntity> {
    return this.store.withTransaction('SUBMIT_REGISTRATION', (db) => {
      const entity = db.entities.find((e) => e.id === id);
      if (!entity) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity ${id} was not found`);
      }
      if (
        entity.registrationStatus !== 'DRAFT' &&
        entity.registrationStatus !== 'REJECTED'
      ) {
        throw new AppError(
          400,
          'INVALID_STATUS_TRANSITION',
          `Cannot submit entity in status ${entity.registrationStatus}`
        );
      }
      const prev = entity.registrationStatus;
      entity.registrationStatus = 'SUBMITTED';
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'REGISTRATION_SUBMITTED',
        module: 'ENTITY_REGISTRATION',
        entityType: entity.entityType,
        entityId: entity.id,
        previousValueSummary: `Status: ${prev}`,
        newValueSummary: 'Status: SUBMITTED',
        correlationId,
      });
      return entity;
    });
  }

  public async approveRegistration(
    actor: JwtClaims,
    id: string,
    comments: string,
    govStatus: GovVerificationStatus | undefined,
    correlationId: string
  ): Promise<MunicipalEntity> {
    return this.store.withTransaction('APPROVE_REGISTRATION', (db) => {
      const entity = db.entities.find((e) => e.id === id);
      if (!entity) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity ${id} was not found`);
      }
      if (!hasWardJurisdiction(actor, entity.wardId, db.wards)) {
        throw new AppError(
          403,
          'JURISDICTION_FORBIDDEN',
          `Officer ${actor.loginIdentifier} does not have jurisdiction over Ward ${entity.wardId}`
        );
      }
      if (
        entity.registrationStatus !== 'SUBMITTED' &&
        entity.registrationStatus !== 'UNDER_REVIEW'
      ) {
        throw new AppError(
          400,
          'INVALID_STATUS_TRANSITION',
          `Cannot approve registration from status ${entity.registrationStatus}`
        );
      }

      const prev = entity.registrationStatus;
      entity.registrationStatus = 'ACTIVE';
      if (govStatus) {
        entity.govVerificationStatus = govStatus;
      }
      entity.officerComments = comments;

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'OFFICERAPPROVEDREGISTRATION',
        module: 'REGISTRATION_APPROVAL',
        entityType: entity.entityType,
        entityId: entity.id,
        previousValueSummary: `Status: ${prev}`,
        newValueSummary: `Status: ACTIVE (${comments})`,
        correlationId,
      });

      return entity;
    });
  }

  public async rejectRegistration(
    actor: JwtClaims,
    id: string,
    reason: string,
    correlationId: string
  ): Promise<MunicipalEntity> {
    return this.store.withTransaction('REJECT_REGISTRATION', (db) => {
      const entity = db.entities.find((e) => e.id === id);
      if (!entity) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity ${id} was not found`);
      }
      if (!hasWardJurisdiction(actor, entity.wardId, db.wards)) {
        throw new AppError(
          403,
          'JURISDICTION_FORBIDDEN',
          `Officer ${actor.loginIdentifier} does not have jurisdiction over Ward ${entity.wardId}`
        );
      }
      if (
        entity.registrationStatus !== 'SUBMITTED' &&
        entity.registrationStatus !== 'UNDER_REVIEW'
      ) {
        throw new AppError(
          400,
          'INVALID_STATUS_TRANSITION',
          `Cannot reject registration from status ${entity.registrationStatus}`
        );
      }

      const prev = entity.registrationStatus;
      entity.registrationStatus = 'REJECTED';
      entity.rejectionReason = reason;
      entity.officerComments = reason;

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'OFFICERREJECTEDREGISTRATION',
        module: 'REGISTRATION_APPROVAL',
        entityType: entity.entityType,
        entityId: entity.id,
        previousValueSummary: `Status: ${prev}`,
        newValueSummary: `Status: REJECTED (Reason: ${reason})`,
        correlationId,
      });

      return entity;
    });
  }

  /**
   * Authoritative Balance Calculation from Stored Ledger Records (Section 9 & Module D)
   * Never trusts client-provided outstanding numbers.
   */
  public async getEntityOutstandingAndDues(actor: JwtClaims, entityId: string) {
    const db = await this.store.readAll();
    const entity = db.entities.find((e) => e.id === entityId);
    if (!entity) {
      throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity ${entityId} was not found`);
    }
    assertCitizenEntityOwnership(actor, entity.id, entity.mobile);

    const entityDues = db.dues.filter((d) => d.entityId === entityId);
    let originalTotalPaise = 0;
    let adjustmentsTotalPaise = 0;
    let waiversTotalPaise = 0;
    let paidTotalPaise = 0;
    let remainingTotalPaise = 0;

    for (const d of entityDues) {
      if (d.status === 'CANCELLED') continue;
      originalTotalPaise += Money.inrToPaise(d.originalAmount);
      adjustmentsTotalPaise += Money.inrToPaise(d.adjustmentsAmount);
      waiversTotalPaise += Money.inrToPaise(d.waiversAmount);
      paidTotalPaise += Money.inrToPaise(d.paidAmount);
      remainingTotalPaise += Money.inrToPaise(d.outstandingAmount);
    }

    return {
      entityId: entity.id,
      registrationNumber: entity.registrationNumber,
      name: entity.name,
      currency: 'INR',
      breakdown: {
        originalChargesInr: Money.paiseToInr(originalTotalPaise),
        adjustmentsInr: Money.paiseToInr(adjustmentsTotalPaise),
        waiversInr: Money.paiseToInr(waiversTotalPaise),
        paidAllocatedInr: Money.paiseToInr(paidTotalPaise),
        remainingOutstandingInr: Money.paiseToInr(remainingTotalPaise),
      },
      dues: entityDues,
    };
  }

  // Module C — Rate Master
  public async listRates(filters: { categoryId?: string; status?: string }) {
    const db = await this.store.readAll();
    let list = db.rates;
    if (filters.categoryId) {
      list = list.filter((r) => r.categoryId === filters.categoryId);
    }
    if (filters.status) {
      list = list.filter((r) => r.status === filters.status);
    }
    return list;
  }

  public async getRateById(id: string): Promise<RateMaster> {
    const db = await this.store.readAll();
    const rate = db.rates.find((r) => r.id === id);
    if (!rate) {
      throw new AppError(404, 'RATE_NOT_FOUND', `Rate ${id} was not found`);
    }
    return rate;
  }

  public async createRate(
    actor: JwtClaims,
    payload: {
      categoryId: string;
      feeType: string;
      vehicleType?: string;
      frequency: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
      amountInr: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      wardScope: string;
      status: 'ACTIVE' | 'UPCOMING' | 'EXPIRED';
    },
    correlationId: string
  ): Promise<RateMaster> {
    return this.store.withTransaction('CREATE_RATE', (db) => {
      const category = db.categories.find((c) => c.id === payload.categoryId);
      if (!category) {
        throw new AppError(
          404,
          'CATEGORY_NOT_FOUND',
          `Category ${payload.categoryId} not found`
        );
      }

      // Conflict detection: prevent duplicate ACTIVE rate for same category, wardScope, and effectiveFrom
      const conflict = db.rates.find(
        (r) =>
          r.categoryId === payload.categoryId &&
          r.wardScope === payload.wardScope &&
          r.effectiveFrom === payload.effectiveFrom &&
          r.status !== 'EXPIRED'
      );
      if (conflict) {
        throw new AppError(
          409,
          'RATE_CONFLICT',
          `Overlapping rate ${conflict.id} already exists for category ${category.name} effective ${payload.effectiveFrom}`
        );
      }

      const newRate: RateMaster = {
        id: `RT-2026-0${db.rates.length + 10}`,
        categoryId: category.id,
        categoryName: category.name,
        feeType: payload.feeType,
        vehicleType: payload.vehicleType,
        frequency: payload.frequency,
        amountInr: payload.amountInr,
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        wardScope: payload.wardScope,
        status: payload.status,
        createdBy: actor.loginIdentifier,
        createdAt: new Date().toISOString(),
      };

      // Note: Historical dues are NEVER recalculated when a new rate is created (Module C & D rule)
      if (newRate.status === 'ACTIVE') {
        category.activeRateId = newRate.id;
        category.activeRateAmount = newRate.amountInr;
      }

      db.rates.unshift(newRate);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMINCHANGEDRATE',
        module: 'RATE_MASTER',
        entityType: 'RATE',
        entityId: newRate.id,
        previousValueSummary: 'Historical dues untouched',
        newValueSummary: `Published ${newRate.id}: INR ${newRate.amountInr} (${newRate.frequency}) effective ${newRate.effectiveFrom}`,
        correlationId,
      });

      return newRate;
    });
  }

  public async updateRate(
    actor: JwtClaims,
    id: string,
    payload: Partial<{
      feeType: string;
      amountInr: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      status: 'ACTIVE' | 'UPCOMING' | 'EXPIRED';
    }>,
    correlationId: string
  ): Promise<RateMaster> {
    return this.store.withTransaction('UPDATE_RATE', (db) => {
      const rate = db.rates.find((r) => r.id === id);
      if (!rate) {
        throw new AppError(404, 'RATE_NOT_FOUND', `Rate ${id} was not found`);
      }
      const prev = `INR ${rate.amountInr} (${rate.status})`;
      Object.assign(rate, payload);

      // Historical dues remain untouched!
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMINCHANGEDRATE',
        module: 'RATE_MASTER',
        entityType: 'RATE',
        entityId: rate.id,
        previousValueSummary: prev,
        newValueSummary: `INR ${rate.amountInr} (${rate.status}) [Historical dues preserved]`,
        correlationId,
      });

      return rate;
    });
  }

  // Module D — Due Engine
  public async listDues(
    actor: JwtClaims,
    filters: { entityId?: string; status?: string; wardName?: string }
  ): Promise<DueRecord[]> {
    const db = await this.store.readAll();
    let list = db.dues;

    if (actor.role === 'CITIZEN') {
      const linked = actor.linkedEntityIds || [];
      list = list.filter((d) => linked.includes(d.entityId));
    }

    if (filters.entityId) {
      list = list.filter((d) => d.entityId === filters.entityId);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((d) => d.status === filters.status);
    }
    if (filters.wardName && filters.wardName !== 'ALL') {
      list = list.filter((d) =>
        d.wardName.toUpperCase().includes(filters.wardName!.toUpperCase())
      );
    }
    return list;
  }

  public async generateDuesBatch(
    actor: JwtClaims,
    payload: {
      categoryId: string;
      wardId: string;
      periodStart: string;
      periodEnd: string;
      feeLabel?: string;
      entityIds?: string[];
    },
    correlationId: string
  ) {
    return this.store.withTransaction('GENERATE_DUES_BATCH', (db) => {
      const category = db.categories.find((c) => c.id === payload.categoryId);
      if (!category) {
        throw new AppError(
          404,
          'CATEGORY_NOT_FOUND',
          `Category ${payload.categoryId} not found`
        );
      }

      const activeRate = db.rates.find(
        (r) => r.categoryId === category.id && r.status === 'ACTIVE'
      );
      if (!activeRate) {
        throw new AppError(
          400,
          'NO_ACTIVE_RATE',
          `No active rate master found for category ${category.name}`
        );
      }

      let candidateEntities = db.entities.filter(
        (e) =>
          e.categoryId === category.id && e.registrationStatus === 'ACTIVE'
      );

      if (payload.wardId && payload.wardId !== 'ALL') {
        candidateEntities = candidateEntities.filter(
          (e) => e.wardId.toUpperCase() === payload.wardId.toUpperCase()
        );
      }
      if (payload.entityIds && payload.entityIds.length > 0) {
        candidateEntities = candidateEntities.filter((e) =>
          payload.entityIds!.includes(e.id)
        );
      }

      const createdDues: DueRecord[] = [];
      const skippedDuplicates: string[] = [];

      for (const ent of candidateEntities) {
        const duplicate = db.dues.find(
          (d) =>
            d.entityId === ent.id &&
            d.periodStart === payload.periodStart &&
            d.periodEnd === payload.periodEnd &&
            d.status !== 'CANCELLED'
        );
        if (duplicate) {
          skippedDuplicates.push(ent.registrationNumber);
          continue;
        }

        const due: DueRecord = {
          id: `DUE-2026-${100 + db.dues.length + createdDues.length + 1}`,
          entityId: ent.id,
          entityName: ent.name,
          registrationNumber: ent.registrationNumber,
          categoryName: category.name,
          wardName: ent.wardName,
          rateId: activeRate.id,
          feeType:
            payload.feeLabel ||
            `${activeRate.feeType} (${payload.periodStart} - ${payload.periodEnd})`,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          originalAmount: activeRate.amountInr,
          adjustmentsAmount: 0,
          waiversAmount: 0,
          paidAmount: 0,
          outstandingAmount: activeRate.amountInr,
          status: 'PENDING',
          generationDate: new Date().toISOString().slice(0, 10),
        };

        createdDues.push(due);
        ent.newCharges = Money.addInr(ent.newCharges, activeRate.amountInr);
        ent.outstandingAmount = Money.addInr(
          ent.outstandingAmount,
          activeRate.amountInr
        );
      }

      if (createdDues.length === 0 && skippedDuplicates.length > 0) {
        throw new AppError(
          409,
          'DUPLICATE_DUE_PERIOD',
          `Dues for period ${payload.periodStart} to ${payload.periodEnd} already exist for all matching entities`,
          skippedDuplicates
        );
      }

      db.dues.unshift(...createdDues);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'BATCH_DUES_GENERATED',
        module: 'DUE_ENGINE',
        entityType: 'DUE_BATCH',
        entityId: activeRate.id,
        previousValueSummary: `Matched ${candidateEntities.length} entities`,
        newValueSummary: `Generated ${createdDues.length} dues @ INR ${activeRate.amountInr} (${skippedDuplicates.length} duplicates skipped)`,
        correlationId,
      });

      return {
        generatedCount: createdDues.length,
        skippedDuplicatesCount: skippedDuplicates.length,
        rateApplied: activeRate.id,
        amountPerEntityInr: activeRate.amountInr,
        dues: createdDues,
      };
    });
  }

  public async adjustOrWaiveDue(
    actor: JwtClaims,
    dueId: string,
    type: 'ADJUSTMENT' | 'WAIVER',
    payload: {
      amountInr: number;
      reason: string;
      supportingRef: string;
      autoApprove?: boolean;
    },
    correlationId: string
  ): Promise<{ due: DueRecord; adjustment: DueAdjustment }> {
    return this.store.withTransaction('ADJUST_OR_WAIVE_DUE', (db) => {
      const due = db.dues.find((d) => d.id === dueId);
      if (!due) {
        throw new AppError(404, 'DUE_NOT_FOUND', `Due ${dueId} was not found`);
      }

      const amountPaise = Money.inrToPaise(payload.amountInr);
      const currentOutPaise = Money.inrToPaise(due.outstandingAmount);
      if (amountPaise > currentOutPaise) {
        throw new AppError(
          400,
          'INVALID_ADJUSTMENT_AMOUNT',
          `${type} amount (INR ${payload.amountInr}) cannot exceed remaining due balance (INR ${due.outstandingAmount})`
        );
      }

      const beforeBalance = due.outstandingAmount;
      const shouldApplyImmediately =
        actor.role === 'ADMIN' || payload.autoApprove === true;
      const afterBalance = shouldApplyImmediately
        ? Money.subInr(beforeBalance, payload.amountInr)
        : beforeBalance;

      if (shouldApplyImmediately) {
        if (type === 'WAIVER') {
          due.waiversAmount = Money.addInr(due.waiversAmount, payload.amountInr);
        } else {
          due.adjustmentsAmount = Money.addInr(
            due.adjustmentsAmount,
            payload.amountInr
          );
        }
        due.outstandingAmount = afterBalance;
        if (due.outstandingAmount === 0) {
          due.status = type === 'WAIVER' ? 'WAIVED' : 'PAID';
        }

        const entity = db.entities.find((e) => e.id === due.entityId);
        if (entity) {
          if (type === 'WAIVER') {
            entity.waiversTotal = Money.addInr(
              entity.waiversTotal,
              payload.amountInr
            );
          } else {
            entity.adjustmentsTotal = Money.addInr(
              entity.adjustmentsTotal,
              payload.amountInr
            );
          }
          entity.outstandingAmount = Math.max(
            0,
            Money.subInr(entity.outstandingAmount, payload.amountInr)
          );
        }
      }

      const adjRecord: DueAdjustment = {
        id: `ADJ-2026-0${db.adjustments.length + 20}`,
        dueId: due.id,
        entityId: due.entityId,
        entityName: `${due.entityName} (${due.registrationNumber})`,
        type,
        amountInr: payload.amountInr,
        beforeBalance,
        afterBalance: Money.subInr(beforeBalance, payload.amountInr),
        reason: payload.reason,
        supportingRef: payload.supportingRef,
        requestedBy: actor.loginIdentifier,
        requestedAt: new Date().toISOString(),
        approvalStatus: shouldApplyImmediately ? 'APPROVED' : 'PENDING',
        reviewedBy: shouldApplyImmediately ? actor.loginIdentifier : undefined,
        reviewedAt: shouldApplyImmediately ? new Date().toISOString() : undefined,
      };

      db.adjustments.unshift(adjRecord);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: type === 'WAIVER' ? 'DUE_WAIVER_RECORDED' : 'DUE_ADJUSTMENT_RECORDED',
        module: 'DUE_LEDGER',
        entityType: 'DUE',
        entityId: due.id,
        previousValueSummary: `Due Bal: INR ${beforeBalance}`,
        newValueSummary: `${type} INR ${payload.amountInr} (${adjRecord.approvalStatus}) -> Bal: INR ${due.outstandingAmount}`,
        correlationId,
      });

      return { due, adjustment: adjRecord };
    });
  }
}
