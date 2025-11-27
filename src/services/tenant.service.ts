import { NewTenantBody } from '../types/tenant.type'

import TenantCollection from '../models/tenant.model'

export default class TenantService {
  async createNew(body: NewTenantBody) {
    return TenantCollection.create(body)
  }

  async getTenants() {
    return TenantCollection.find({})
  }
}
