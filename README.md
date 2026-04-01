# DSS — Система підтримки прийняття рішень
## Вибір хмарного провайдера (MongoDB + Node.js)

---

## Предметна область

Вибір оптимального хмарного провайдера для IT-компанії — реальна напівструктурована задача, яка потребує СППР, оскільки рішення залежить від набору кількісних і якісних критеріїв.

**Множина альтернатив A:**
- A1 = AWS (Amazon Web Services)
- A2 = Azure (Microsoft)
- A3 = Google Cloud Platform
- A4 = DigitalOcean

**Множина критеріїв C:**
| Критерій | Тип | Вага |
|----------|-----|------|
| Вартість ($/міс) | minimize | 0.30 |
| Надійність (uptime %) | maximize | 0.25 |
| Швидкість (мс) | minimize | 0.20 |
| Технічна підтримка (1-10) | maximize | 0.15 |
| Масштабованість (1-10) | maximize | 0.10 |

---

## Архітектура системи

```
Controller  ←→  Service  ←→  MongoDB
   ↑               ↑
   HTTP API      Analytics Engine
                (WSM / SAW / TOPSIS)
```

**Шари системи:**
- **Controller** (`controllers/dssController.js`) — обробка HTTP-запитів
- **Service** (`services/`) — бізнес-логіка та аналітика
- **Models** (`models/`) — MongoDB схеми
- **Routes** (`routes/dssRoutes.js`) — маршрутизація

---

## Установка та запуск

```bash
# 1. Клонувати репозиторій
git clone <repo-url>
cd dss-cloud

# 2. Встановити залежності
npm install

# 3. Запустити MongoDB локально (або вказати URI у .env)
# .env (опційно):
# MONGO_URI=mongodb://localhost:27017/dss_cloud
# PORT=3000

# 4. Заповнити базу тестовими даними
node seed.js

# 5. Запустити сервер
npm start
```

---

## API Reference

### Критерії
```
GET    /api/criteria               — список критеріїв
POST   /api/criteria               — додати критерій
DELETE /api/criteria/:id           — видалити
GET    /api/criteria/validate      — перевірити суму ваг
```

**POST /api/criteria — тіло запиту:**
```json
{
  "name": "Вартість",
  "type": "minimize",
  "weight": 0.30,
  "description": "Щомісячна вартість"
}
```

### Альтернативи
```
GET    /api/alternatives                          — список
POST   /api/alternatives                          — додати
DELETE /api/alternatives/:id                      — видалити
PATCH  /api/alternatives/:id/score/:criteriaId    — встановити оцінку
```

**POST /api/alternatives:**
```json
{ "name": "AWS", "description": "Amazon Web Services" }
```

**PATCH /api/alternatives/:id/score/:criteriaId:**
```json
{ "score": 450 }
```

### Аналіз (СППР)
```
GET /api/matrix               — матриця оцінювання
GET /api/analyze?method=SAW   — аналіз одним методом (WSM|SAW|TOPSIS)
GET /api/analyze/all          — всі три методи
GET /api/decisions            — історія рішень
```

---

## Методи аналізу

### WSM (Weighted Sum Model)
Зважена сума без нормалізації:
```
score_i = Σ(w_j × x_ij)
```
Для критеріїв типу `minimize` значення інвертується.

### SAW (Simple Additive Weighting)
Нормалізовані оцінки за діапазоном [0,1]:
```
r_ij = (x_ij - min_j) / (max_j - min_j)   [maximize]
r_ij = (max_j - x_ij) / (max_j - min_j)   [minimize]
score_i = Σ(w_j × r_ij)
```

### TOPSIS
Вибір альтернативи, найближчої до ідеальної:
```
1. Нормалізація: v_ij = x_ij / √Σ(x_ij²)
2. Зважена матриця: w_ij = w_j × v_ij
3. Ідеал A+, антиідеал A-
4. d+_i = √Σ(w_ij - A+_j)², d-_i = √Σ(w_ij - A-_j)²
5. score_i = d-_i / (d+_i + d-_i)
```

---

## Приклад результату GET /api/analyze/all

```json
{
  "success": true,
  "data": {
    "SAW": {
      "method": "SAW",
      "ranking": [
        { "alternative": "DigitalOcean", "score": 0.7821, "rank": 1 },
        { "alternative": "Google Cloud", "score": 0.6543, "rank": 2 },
        { "alternative": "Azure",        "score": 0.5234, "rank": 3 },
        { "alternative": "AWS",          "score": 0.4123, "rank": 4 }
      ],
      "best": "DigitalOcean",
      "explanation": "Метод SAW: найкращою альтернативою визначено \"DigitalOcean\"..."
    },
    "WSM": { ... },
    "TOPSIS": { ... }
  }
}
```

---

## Структура MongoDB

**Collection `alternatives`:**
```json
{
  "_id": "ObjectId",
  "name": "AWS",
  "description": "...",
  "scores": { "<criteriaId>": 450, ... }
}
```

**Collection `criteria`:**
```json
{
  "_id": "ObjectId",
  "name": "Вартість",
  "type": "minimize",
  "weight": 0.30
}
```

**Collection `decisions`:**
```json
{
  "method": "SAW",
  "ranking": [...],
  "best": "DigitalOcean",
  "explanation": "...",
  "snapshot": { "criteria": [...], "alternatives": [...] }
}
```

---

## Автор
Модульний контроль — Бази даних (MongoDB)
