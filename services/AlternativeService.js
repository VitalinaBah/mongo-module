const Alternative = require('../models/Alternative');

class AlternativeService {
  async getAll() {
    return Alternative.find().sort({ name: 1 });
  }

  async getById(id) {
    const alt = await Alternative.findById(id);
    if (!alt) throw new Error(`Alternative ${id} not found`);
    return alt;
  }

  async create(data) {
    const alt = new Alternative(data);
    return alt.save();
  }

  async update(id, data) {
    const alt = await Alternative.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!alt) throw new Error(`Alternative ${id} not found`);
    return alt;
  }

  async setScore(id, criteriaId, score) {
    const alt = await Alternative.findById(id);
    if (!alt) throw new Error(`Alternative ${id} not found`);
    alt.scores.set(criteriaId.toString(), score);
    return alt.save();
  }

  async remove(id) {
    const alt = await Alternative.findByIdAndDelete(id);
    if (!alt) throw new Error(`Alternative ${id} not found`);
    return alt;
  }

  // Повертає матрицю оцінювання: рядки = альтернативи, стовпці = критерії
  async getMatrix(criteriaIds) {
    const alts = await this.getAll();
    return alts.map(alt => ({
      id: alt._id.toString(),
      name: alt.name,
      scores: criteriaIds.map(cid => alt.scores.get(cid.toString()) ?? 0)
    }));
  }
}

module.exports = new AlternativeService();
