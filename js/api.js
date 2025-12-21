// API клиент для работы с Claude и OpenAI
class AIClient {
  constructor() {
    this.customPrompts = null; // Для кастомных промптов из UI
  }

  // Установка кастомных промптов из UI
  setCustomPrompts(system, user) {
    this.customPrompts = { system, user };
  }

  // Сброс кастомных промптов
  clearCustomPrompts() {
    this.customPrompts = null;
  }

  // Получение промптов для режима анализа
  getPromptsForMode(mode) {
    // Если есть кастомные промпты — используем их
    if (this.customPrompts) {
      return {
        system: this.customPrompts.system,
        user: this.customPrompts.user
      };
    }

    // Иначе берём из конфига
    const prompts = PROMPTS[mode];
    if (!prompts) {
      console.warn(`Промпт для режима ${mode} не найден, используем verified`);
      return PROMPTS.verified;
    }
    return prompts;
  }

  // Конвертация изображения в base64
  async imageToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Сжатие изображения
  async compressImage(file, maxDimension = CONFIG.app.maxImageDimension) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: file.type })),
          file.type,
          CONFIG.app.compressionQuality
        );
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // Вызов Claude API
  async callClaude(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey) {
    const requestBody = {
      model: model.id,
      max_tokens: model.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: userPrompt
            }
          ]
        }
      ]
    };

    const response = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API error');
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // Вызов OpenAI API
  async callOpenAI(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey) {
    const requestBody = {
      model: model.id,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: model.maxTokens
    };

    const response = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Универсальный вызов API
  async callAPI(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey) {
    if (model.provider === 'anthropic') {
      return await this.callClaude(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey);
    } else if (model.provider === 'openai') {
      return await this.callOpenAI(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey);
    } else {
      throw new Error(`Неподдерживаемый провайдер: ${model.provider}`);
    }
  }

  // Парсинг ответа первого этапа (для двухэтапного режима)
  parseStep1Response(response) {
    const lines = response.split('\n');
    const result = {
      viewpoint: '',
      childWhere: '',
      childLooking: '',
      legs: '',
      position: ''
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('РАКУРС:')) {
        result.viewpoint = trimmed.replace('РАКУРС:', '').trim();
      } else if (trimmed.startsWith('РЕБЁНОК_ГДЕ:')) {
        result.childWhere = trimmed.replace('РЕБЁНОК_ГДЕ:', '').trim();
      } else if (trimmed.startsWith('РЕБЁНОК_КУДА_СМОТРИТ:')) {
        result.childLooking = trimmed.replace('РЕБЁНОК_КУДА_СМОТРИТ:', '').trim();
      } else if (trimmed.startsWith('НОГИ:')) {
        result.legs = trimmed.replace('НОГИ:', '').trim();
      } else if (trimmed.startsWith('ПОЗИЦИЯ:')) {
        result.position = trimmed.replace('ПОЗИЦИЯ:', '').trim();
      }
      // Поддержка старого формата
      else if (trimmed.startsWith('ПЕРЕНОСКА:')) {
        result.childWhere = trimmed.replace('ПЕРЕНОСКА:', '').trim();
      } else if (trimmed.startsWith('РЕБЁНОК:')) {
        result.childLooking = trimmed.replace('РЕБЁНОК:', '').trim();
      }
    }

    return result;
  }

  // Анализ одноэтапный
  async analyzeSingleStep(imageFile, modelKey, apiKey, mode) {
    const model = CONFIG.models[modelKey];
    const prompts = this.getPromptsForMode(mode);

    const processedImage = await this.compressImage(imageFile);
    const base64Image = await this.imageToBase64(processedImage);
    const mediaType = processedImage.type;

    return await this.callAPI(
      base64Image,
      mediaType,
      prompts.system,
      prompts.user,
      model,
      apiKey
    );
  }

  // Анализ двухэтапный
  async analyzeTwoStep(imageFile, modelKey, apiKey, onStep1Complete) {
    const model = CONFIG.models[modelKey];
    const prompts = PROMPTS.twoStep;

    const processedImage = await this.compressImage(imageFile);
    const base64Image = await this.imageToBase64(processedImage);
    const mediaType = processedImage.type;

    // Этап 1: Определение позиции
    const step1Response = await this.callAPI(
      base64Image,
      mediaType,
      prompts.step1.system,
      prompts.step1.user,
      model,
      apiKey
    );

    const parsed = this.parseStep1Response(step1Response);
    
    // Колбэк для отображения промежуточного результата
    if (onStep1Complete) {
      onStep1Complete(step1Response, parsed);
    }

    // Этап 2: Полный анализ с известной позицией
    const step2UserPrompt = prompts.step2.getUserPrompt(parsed.position, parsed.legs);
    
    const step2Response = await this.callAPI(
      base64Image,
      mediaType,
      prompts.step2.system,
      step2UserPrompt,
      model,
      apiKey
    );

    return {
      step1: step1Response,
      step1Parsed: parsed,
      step2: step2Response,
      combined: `## 📍 ЭТАП 1: Определение позиции\n\n${step1Response}\n\n---\n\n## 📋 ЭТАП 2: Полный анализ\n\n${step2Response}`
    };
  }

  // Анализ с ручной позицией (пропускаем определение позиции)
  async analyzeWithManualPosition(imageFile, modelKey, apiKey, position, legs) {
    const model = CONFIG.models[modelKey];

    const processedImage = await this.compressImage(imageFile);
    const base64Image = await this.imageToBase64(processedImage);
    const mediaType = processedImage.type;

    let systemPrompt, userPrompt;

    if (legs) {
      // Если ноги указаны — используем стандартный промпт второго этапа
      systemPrompt = PROMPTS.twoStep.step2.system;
      userPrompt = PROMPTS.twoStep.step2.getUserPrompt(position, legs);
    } else {
      // Если ноги НЕ указаны — модель должна определить сама
      systemPrompt = `Вы — консультант по слингоношению. 
Позиция ребёнка УЖЕ ОПРЕДЕЛЕНА пользователем: ${position}
НЕ ПЫТАЙТЕСЬ переопределить позицию — она указана правильно.

Ваша задача:
1. Определить положение ног (М-позиция или нет)
2. Провести анализ T.I.C.K.S.

М-ПОЗИЦИЯ — оценивайте честно по фото:
- Колени ВЫШЕ попы, бёдра разведены = ✅ М-позиция OK
- Колени НА УРОВНЕ попы = ⚠️ Частичная
- Колени НИЖЕ попы, ноги свисают вертикально = ❌ НЕТ М-позиции

ЯЗЫК: Только "взрослый", "родитель" (не мама/папа).`;

      userPrompt = `## АНАЛИЗ СЛИНГОНОШЕНИЯ

**Позиция (указана пользователем):** ${position}

### ШАГ 1: ОПРЕДЕЛИ ПОЛОЖЕНИЕ НОГ ПО ФОТО

Посмотри на фото и определи:
- Как расположены ноги ребёнка?
- Колени выше, на уровне или ниже попы?
- Ноги согнуты и разведены или свисают вниз?

**Положение ног:** [опиши что видишь]
**М-позиция:** ✅ OK / ⚠️ Частичная / ❌ Нет

---

### ШАГ 2: T.I.C.K.S. АНАЛИЗ

#### T — Плотность
[оцени]

#### I — Видимость лица
[оцени]

#### C — Высота
[оцени]

#### K — Подбородок
[оцени]

#### S — Поддержка спины
[оцени]

---

${position.includes('ВПЕРЁД') ? `### ⚠️ Forward-facing — особенности:
- Только 6+ месяцев
- Только бодрствующий ребёнок
- Короткие периоды (15-20 мин)

---` : ''}

## ИТОГ

**Оценка:** X/10
**Статус:** 🟢 БЕЗОПАСНО / 🟡 КОРРЕКТИРОВКА / 🔴 ОПАСНО

**✅ Хорошо:**
**❌ Исправить:**
**📋 Действия:**`;
    }

    const response = await this.callAPI(
      base64Image,
      mediaType,
      systemPrompt,
      userPrompt,
      model,
      apiKey
    );

    const legsInfo = legs ? `**Ноги:** ${legs}` : '**Ноги:** определяет модель';
    return `## 📍 Позиция указана вручную\n\n**Позиция:** ${position}\n${legsInfo}\n\n---\n\n${response}`;
  }

  // Главный метод анализа
  async analyze(imageFile, modelKey, apiKey, mode = 'verified', callbacks = {}) {
    const model = CONFIG.models[modelKey];

    if (!model) {
      throw new Error(`Неизвестная модель: ${modelKey}`);
    }

    if (mode === 'twoStep') {
      const result = await this.analyzeTwoStep(imageFile, modelKey, apiKey, callbacks.onStep1Complete);
      return result.combined;
    } else {
      return await this.analyzeSingleStep(imageFile, modelKey, apiKey, mode);
    }
  }
}

// Создаем глобальный экземпляр
const aiClient = new AIClient();
