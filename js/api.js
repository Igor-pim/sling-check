// API клиент для работы с Claude и OpenAI
class AIClient {
  constructor() {
    this.prompts = null;
  }

  // Загрузка промптов из config/prompts.json
  async loadPrompts() {
    if (this.prompts) return this.prompts;

    try {
      const response = await fetch('config/prompts.json');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.prompts = await response.json();
      return this.prompts;
    } catch (error) {
      console.error('Ошибка загрузки промптов:', error);
      throw new Error('Не удалось загрузить конфигурацию промптов');
    }
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

  // Сжатие изображения если оно слишком большое
  async compressImage(file, maxDimension = CONFIG.app.maxImageDimension) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Масштабирование если изображение слишком большое
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

  // Анализ изображения через Claude API
  async analyzeWithClaude(imageFile, apiKey, model) {
    await this.loadPrompts();

    // Сжимаем изображение если нужно
    const processedImage = await this.compressImage(imageFile);
    const base64Image = await this.imageToBase64(processedImage);
    const mediaType = processedImage.type;

    const requestBody = {
      model: model.id,
      max_tokens: model.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: this.prompts.slingAnalysis.userPrompt
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

  // Анализ изображения через OpenAI API
  async analyzeWithOpenAI(imageFile, apiKey, model) {
    await this.loadPrompts();

    // Сжимаем изображение если нужно
    const processedImage = await this.compressImage(imageFile);
    const base64Image = await this.imageToBase64(processedImage);
    const mediaType = processedImage.type;

    const requestBody = {
      model: model.id,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.prompts.slingAnalysis.userPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64Image}`
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

  // Универсальный метод анализа
  async analyze(imageFile, modelKey, apiKey) {
    const model = CONFIG.models[modelKey];

    if (!model) {
      throw new Error(`Неизвестная модель: ${modelKey}`);
    }

    if (model.provider === 'anthropic') {
      return await this.analyzeWithClaude(imageFile, apiKey, model);
    } else if (model.provider === 'openai') {
      return await this.analyzeWithOpenAI(imageFile, apiKey, model);
    } else {
      throw new Error(`Неподдерживаемый провайдер: ${model.provider}`);
    }
  }
}

// Создаем глобальный экземпляр
const aiClient = new AIClient();
