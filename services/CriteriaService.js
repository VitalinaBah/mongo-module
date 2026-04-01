const Criteria = require('../models/Criteria');

class CriteriaService {
  async getAll() {
    return Criteria.find().sort({ weight: -1 });
  }

  async getById(id) {
    const c = await Criteria.findById(id);
    if (!c) throw new Error(`Criteria ${id} not found`);
    return c;
  }

  async create(data) {
    const c = new Criteria(data);
    return c.save();
  }

  async update(id, data) {
    const c = await Criteria.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!c) throw new Error(`Criteria ${id} not found`);
    return c;
  }

  async remove(id) {
    const c = await Criteria.findByIdAndDelete(id);
    if (!c) throw new Error(`Criteria ${id} not found`);
    return c;
  }

  // Перевірити, що сума ваг ≈ 1
  async validateWeights() {
    const all = await this.getAll();
    const sum = all.reduce((acc, c) => acc + c.weight, 0);
    return { valid: Math.abs(sum - 1) < 0.001, sum };
  }
}

module.exports = new CriteriaService();
