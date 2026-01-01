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

  // Вызов LANIT vLLM API (OpenAI-совместимый формат с X-API-KEY)
  async callLanit(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey) {
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
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'LANIT API error';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || error.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
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
    } else if (model.provider === 'lanit') {
      return await this.callLanit(imageBase64, mediaType, systemPrompt, userPrompt, model, apiKey);
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
      age: '',
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
      } else if (trimmed.startsWith('ВОЗРАСТ:')) {
        result.age = trimmed.replace('ВОЗРАСТ:', '').trim();
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

    // Этап 2: Полный анализ с известной позицией и возрастом
    const step2UserPrompt = prompts.step2.getUserPrompt(parsed.position, parsed.legs, parsed.age);
    
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
  async analyzeWithManualPosition(imageFile, modelKey, apiKey, position, age, legs) {
    const model = CONFIG.models[modelKey];

    const processedImage = await this.compressImage(imageFile);
    const base64Image = await this.imageToBase64(processedImage);
    const mediaType = processedImage.type;

    const isBigKid = age && (age.includes('ДОШКОЛЬНИК') || age.includes('ШКОЛЬНИК'));
    const isInfant = age && (age.includes('МЛАДЕНЕЦ') || age.includes('МАЛЫШ'));

    let systemPrompt, userPrompt;

    if (legs && age) {
      // Если и ноги, и возраст указаны — используем стандартный промпт второго этапа
      systemPrompt = PROMPTS.twoStep.step2.system;
      userPrompt = PROMPTS.twoStep.step2.getUserPrompt(position, legs, age);
    } else {
      // Модель должна определить недостающее
      systemPrompt = `Вы — консультант по слингоношению. 
Позиция ребёнка УЖЕ ОПРЕДЕЛЕНА пользователем: ${position}
${age ? `Возраст: ${age}` : 'Возраст: определите по фото'}
НЕ ПЫТАЙТЕСЬ переопределить позицию — она указана правильно.

${isBigKid ? `⚠️ ВАЖНО: Ребёнок ${age} — это НЕ младенец!
М-позиция НЕ ПРИМЕНИМА для детей этого возраста.
НЕ давайте советов про "развести ножки" или "поднять колени выше попы".
Оценивайте только безопасность и комфорт.` : ''}

${!age ? `ОПРЕДЕЛЕНИЕ ВОЗРАСТА:
- МЛАДЕНЕЦ (0-6 мес) — маленький, не держит голову
- МАЛЫШ (6-18 мес) — сидит, но маленький  
- ТОДДЛЕР (1.5-3 года) — ходит, но ещё носят
- ДОШКОЛЬНИК (3-6 лет) — большой ребёнок
- ШКОЛЬНИК (6+ лет) — явно большой

Для ДОШКОЛЬНИКОВ и ШКОЛЬНИКОВ М-позиция НЕ применима!` : ''}

ЯЗЫК: Только "взрослый", "родитель" (не мама/папа).`;

      let mPositionInstructions;
      if (isBigKid) {
        mPositionInstructions = `### М-ПОЗИЦИЯ:
⚠️ Ребёнок ${age} — критерий М-позиции НЕ ПРИМЕНИМ.
Оцените только комфорт и безопасность.`;
      } else if (legs) {
        mPositionInstructions = legs.includes('СВИСАЮТ') 
          ? `### М-ПОЗИЦИЯ:\n❌ Ноги свисают — нет М-позиции.`
          : `### М-ПОЗИЦИЯ:\n✅ М-позиция соблюдена.`;
      } else {
        mPositionInstructions = `### М-ПОЗИЦИЯ:
${!age ? 'Если ребёнок ДОШКОЛЬНИК/ШКОЛЬНИК — М-позиция не применима, пропустите этот критерий.' : ''}
[определи по фото: колени выше/ниже попы, ноги согнуты или свисают]`;
      }

      userPrompt = `## АНАЛИЗ СЛИНГОНОШЕНИЯ

**Позиция (указана):** ${position}
**Возраст:** ${age || 'определите по фото'}
**Ноги:** ${legs || 'определите по фото'}

${!age ? `### ШАГ 0: ОПРЕДЕЛИ ВОЗРАСТ
Посмотри на ребёнка — это младенец, малыш, тоддлер или большой ребёнок (дошкольник/школьник)?
**Возраст:** [ответ]

` : ''}### T.I.C.K.S. АНАЛИЗ:

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

${mPositionInstructions}

---

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

    const ageInfo = age ? `**Возраст:** ${age}` : '**Возраст:** определяет модель';
    const legsInfo = legs ? `**Ноги:** ${legs}` : '**Ноги:** определяет модель';
    return `## 📍 Позиция указана вручную\n\n**Позиция:** ${position}\n${ageInfo}\n${legsInfo}\n\n---\n\n${response}`;
  }

  // Главный метод анализа (одиночное изображение)
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

  // Подготовка нескольких изображений для API
  async prepareMultipleImages(images) {
    const prepared = [];
    for (const img of images) {
      const processedImage = await this.compressImage(img.file);
      const base64Image = await this.imageToBase64(processedImage);
      prepared.push({
        label: img.label,
        base64: base64Image,
        mediaType: processedImage.type
      });
    }
    return prepared;
  }

  // Формирование контента с несколькими изображениями для Claude
  buildMultiImageContentClaude(preparedImages, userPrompt) {
    const content = [];

    // Добавляем изображения с подписями
    preparedImages.forEach((img, idx) => {
      content.push({
        type: 'text',
        text: `📷 Фото ${idx + 1}: ${img.label}`
      });
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.base64
        }
      });
    });

    // Добавляем промпт в конце
    content.push({
      type: 'text',
      text: userPrompt
    });

    return content;
  }

  // Формирование контента с несколькими изображениями для OpenAI/LANIT
  buildMultiImageContentOpenAI(preparedImages, userPrompt) {
    const content = [];

    // Сначала текстовый промпт
    let promptWithLabels = '';
    preparedImages.forEach((img, idx) => {
      promptWithLabels += `📷 Фото ${idx + 1}: ${img.label}\n`;
    });
    promptWithLabels += '\n' + userPrompt;

    content.push({
      type: 'text',
      text: promptWithLabels
    });

    // Затем изображения
    preparedImages.forEach((img) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mediaType};base64,${img.base64}`
        }
      });
    });

    return content;
  }

  // Вызов API с несколькими изображениями
  async callAPIMultiImage(preparedImages, systemPrompt, userPrompt, model, apiKey) {
    if (model.provider === 'anthropic') {
      const content = this.buildMultiImageContentClaude(preparedImages, userPrompt);

      const requestBody = {
        model: model.id,
        max_tokens: model.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content }]
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

    } else if (model.provider === 'openai' || model.provider === 'lanit') {
      const content = this.buildMultiImageContentOpenAI(preparedImages, userPrompt);

      const requestBody = {
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        max_tokens: model.maxTokens
      };

      const headers = {
        'Content-Type': 'application/json'
      };

      if (model.provider === 'lanit') {
        headers['X-API-KEY'] = apiKey;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(model.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `${model.provider.toUpperCase()} API error`;
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error?.message || error.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } else {
      throw new Error(`Неподдерживаемый провайдер: ${model.provider}`);
    }
  }

  // Анализ нескольких изображений
  async analyzeMultiple(images, modelKey, apiKey, mode, childInfo, onProgress) {
    const model = CONFIG.models[modelKey];

    if (!model) {
      throw new Error(`Неизвестная модель: ${modelKey}`);
    }

    if (onProgress) onProgress('Подготовка изображений...', '');
    const preparedImages = await this.prepareMultipleImages(images);

    // Получаем промпты
    const prompts = this.getPromptsForMode(mode);

    // Модифицируем системный промпт для множественных фото
    const photoLabels = images.map(img => img.label).join(', ');
    let systemPrompt = prompts.system + `\n\n📷 ФОТО ДЛЯ АНАЛИЗА: ${photoLabels}
Анализируй ВСЕ предоставленные фото комплексно, сопоставляя информацию с разных ракурсов.`;

    // Добавляем информацию о ребёнке если есть
    let userPrompt = prompts.user;
    if (childInfo.age || childInfo.weight) {
      let childInfoText = '\n\n📋 ИНФОРМАЦИЯ О РЕБЁНКЕ:\n';
      if (childInfo.age) childInfoText += `- Возраст: ${childInfo.age}\n`;
      if (childInfo.weight) childInfoText += `- Вес: ${childInfo.weight} кг\n`;
      childInfoText += '\nУчитывай эту информацию при анализе соответствия переноски возрасту и весу ребёнка.';
      userPrompt = childInfoText + '\n\n' + userPrompt;
    }

    if (onProgress) onProgress('Анализируем...', `${preparedImages.length} фото`);

    const result = await this.callAPIMultiImage(
      preparedImages,
      systemPrompt,
      userPrompt,
      model,
      apiKey
    );

    return result;
  }

  // Анализ нескольких изображений с ручной позицией
  async analyzeMultipleWithManualPosition(images, modelKey, apiKey, manualData, childInfo) {
    const model = CONFIG.models[modelKey];

    if (!model) {
      throw new Error(`Неизвестная модель: ${modelKey}`);
    }

    const preparedImages = await this.prepareMultipleImages(images);
    const { position, age, legs } = manualData;

    const isBigKid = age && (age.includes('ДОШКОЛЬНИК') || age.includes('ШКОЛЬНИК'));
    const photoLabels = images.map(img => img.label).join(', ');

    const systemPrompt = `Вы — консультант по слингоношению.
Позиция ребёнка УЖЕ ОПРЕДЕЛЕНА пользователем: ${position}
${age ? `Возраст: ${age}` : 'Возраст: определите по фото'}
📷 Фото для анализа: ${photoLabels}
НЕ ПЫТАЙТЕСЬ переопределить позицию — она указана правильно.
Анализируйте ВСЕ фото комплексно, сопоставляя информацию с разных ракурсов.

${isBigKid ? `⚠️ ВАЖНО: Ребёнок ${age} — это НЕ младенец!
М-позиция НЕ ПРИМЕНИМА для детей этого возраста.
НЕ давайте советов про "развести ножки" или "поднять колени выше попы".
Оценивайте только безопасность и комфорт.` : ''}

ЯЗЫК: Только "взрослый", "родитель" (не мама/папа).`;

    let mPositionInstructions;
    if (isBigKid) {
      mPositionInstructions = `### М-ПОЗИЦИЯ:
⚠️ Ребёнок ${age} — критерий М-позиции НЕ ПРИМЕНИМ.
Оцените только комфорт и безопасность.`;
    } else if (legs) {
      mPositionInstructions = legs.includes('СВИСАЮТ')
        ? `### М-ПОЗИЦИЯ:\n❌ Ноги свисают — нет М-позиции.`
        : `### М-ПОЗИЦИЯ:\n✅ М-позиция соблюдена.`;
    } else {
      mPositionInstructions = `### М-ПОЗИЦИЯ:
[определи по фото: колени выше/ниже попы, ноги согнуты или свисают]`;
    }

    let childInfoText = '';
    if (childInfo.age || childInfo.weight) {
      childInfoText = '\n📋 ИНФОРМАЦИЯ О РЕБЁНКЕ:\n';
      if (childInfo.age) childInfoText += `- Возраст: ${childInfo.age}\n`;
      if (childInfo.weight) childInfoText += `- Вес: ${childInfo.weight} кг\n`;
    }

    const userPrompt = `## АНАЛИЗ СЛИНГОНОШЕНИЯ (${preparedImages.length} фото)
${childInfoText}
**Позиция (указана):** ${position}
**Возраст:** ${age || 'определите по фото'}
**Ноги:** ${legs || 'определите по фото'}

### T.I.C.K.S. АНАЛИЗ:

#### T — Плотность
[оцени по всем фото]

#### I — Видимость лица
[оцени]

#### C — Высота
[оцени]

#### K — Подбородок
[оцени]

#### S — Поддержка спины
[оцени]

${mPositionInstructions}

---

## ИТОГ

**Оценка:** X/10
**Статус:** 🟢 БЕЗОПАСНО / 🟡 КОРРЕКТИРОВКА / 🔴 ОПАСНО

**✅ Хорошо:**
**❌ Исправить:**
**📋 Действия:**`;

    const response = await this.callAPIMultiImage(
      preparedImages,
      systemPrompt,
      userPrompt,
      model,
      apiKey
    );

    const ageInfo = age ? `**Возраст:** ${age}` : '**Возраст:** определяет модель';
    const legsInfo = legs ? `**Ноги:** ${legs}` : '**Ноги:** определяет модель';
    return `## 📍 Позиция указана вручную (${preparedImages.length} фото)\n\n**Позиция:** ${position}\n${ageInfo}\n${legsInfo}\n\n---\n\n${response}`;
  }
}

// Создаем глобальный экземпляр
const aiClient = new AIClient();
