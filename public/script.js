document.addEventListener('DOMContentLoaded', () => {
  // Элементы DOM
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const resultsContainer = document.getElementById('resultsContainer');
  const videoModal = document.getElementById('videoModal');
  const modalContent = document.getElementById('modalContent');
  const closeModal = document.getElementById('closeModal');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const randomBtn = document.getElementById('randomBtn');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const languageSwitch = document.getElementById('languageSwitch');
  const loader = document.getElementById('loader');
  
  let currentSearchTerm = '';
  let nextPageToken = '';
  let prevPageToken = '';
  let currentVideoIframe = null;
  let currentLanguage = 'ru';
  let currentChannelId = '';
  let currentCategoryId = '';
  let currentPage = 1;
  let totalPages = 1;
  let pageTokens = {};
  // Инициализация приложения
  initApp();

  async function initApp() {
    await loadCategories();
    loadPopularVideos();
  }

 // Обработчик ввода в поисковую строку
searchInput.addEventListener('input', function(e) {
  // Удаляем пробелы в начале
  if (this.value.startsWith(' ')) {
    this.value = this.value.trimStart();
  }
  
  // Заменяем множественные пробелы на один
  this.value = this.value.replace(/\s+/g, ' ');
  
  // Ограничение длины (на случай, если вставлен длинный текст)
  if (this.value.length > 200) {
    this.value = this.value.substring(0, 200);
  }
});

// Обработчик нажатия кнопки поиска
searchButton.addEventListener('click', () => {
  const searchTerm = searchInput.value.trim();
  
  if (!searchTerm) {
    showError('Введите поисковый запрос');
    return;
  }
  
  if (searchTerm.length > 200) {
    showError('Запрос слишком длинный (макс. 200 символов)');
    return;
  }
  
  // Ваш существующий код поиска
  currentSearchTerm = searchTerm;
  searchVideos(searchTerm);
});

// Обработчик нажатия Enter
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchButton.click();
  }
});

  loadMoreBtn.addEventListener('click', () => {
    if (currentChannelId) {
      loadChannelVideos(currentChannelId, nextPageToken);
    } else if (currentCategoryId) {
      loadCategoryVideos(currentCategoryId, nextPageToken);
    } else if (currentSearchTerm) {
      searchVideos(currentSearchTerm, nextPageToken);
    } else {
      loadPopularVideos(nextPageToken);
    }
  });

  randomBtn.addEventListener('click', () => {
    currentCategoryId = '';
    currentChannelId = '';
    loadPopularVideos();
  });

  languageSwitch.addEventListener('change', (e) => {
    currentLanguage = e.target.checked ? 'en' : 'ru';
    if (currentSearchTerm) {
      searchVideos(currentSearchTerm);
    } else if (currentChannelId) {
      loadChannelVideos(currentChannelId);
    } else if (currentCategoryId) {
      loadCategoryVideos(currentCategoryId);
    } else {
      loadPopularVideos();
    }
  });

  closeModal.addEventListener('click', () => {
    closeVideoModal();
  });

  window.addEventListener('click', (e) => {
    if (e.target === videoModal) {
      closeVideoModal();
    }
  });


  // Новая функция для создания пагинации
function createPagination(current, total, channelId = null, categoryId = null, searchTerm = null) {
  const pagination = document.createElement('div');
  pagination.className = 'pagination';
  
  // Кнопка "Назад"
  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '&laquo;';
  prevBtn.disabled = current === 1;
  prevBtn.addEventListener('click', () => {
    if (current > 1) {
      navigateToPage(current - 1, channelId, categoryId, searchTerm);
    }
  });
  
  // Номера страниц
  const pagesContainer = document.createElement('div');
  pagesContainer.className = 'pages';
  
  const maxVisiblePages = 5;
  let startPage = Math.max(1, current - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(total, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  // Первая страница
  if (startPage > 1) {
    const firstPage = document.createElement('button');
    firstPage.textContent = '1';
    firstPage.addEventListener('click', () => {
      navigateToPage(1, channelId, categoryId, searchTerm);
    });
    pagesContainer.appendChild(firstPage);
    
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      pagesContainer.appendChild(ellipsis);
    }
  }
  
  // Видимые страницы
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i;
    if (i === current) {
      pageBtn.className = 'active';
    }
    pageBtn.addEventListener('click', () => {
      navigateToPage(i, channelId, categoryId, searchTerm);
    });
    pagesContainer.appendChild(pageBtn);
  }
  
  // Последняя страница
  if (endPage < total) {
    if (endPage < total - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      pagesContainer.appendChild(ellipsis);
    }
    
    const lastPage = document.createElement('button');
    lastPage.textContent = total;
    lastPage.addEventListener('click', () => {
      navigateToPage(total, channelId, categoryId, searchTerm);
    });
    pagesContainer.appendChild(lastPage);
  }
  
  // Кнопка "Вперед"
  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '&raquo;';
  nextBtn.disabled = current === total;
  nextBtn.addEventListener('click', () => {
    if (current < total) {
      navigateToPage(current + 1, channelId, categoryId, searchTerm);
    }
  });
  
  pagination.appendChild(prevBtn);
  pagination.appendChild(pagesContainer);
  pagination.appendChild(nextBtn);
  
  return pagination;
}

// Функция для навигации по страницам
function navigateToPage(page, channelId, categoryId, searchTerm) {
  currentPage = page;
  
  if (channelId) {
    loadChannelVideos(channelId, page);
  } else if (categoryId) {
    loadCategoryVideos(categoryId, page);
  } else if (searchTerm) {
    searchVideos(searchTerm, page);
  } else {
    loadPopularVideos(page);
  }
}
  // Функция для надежного закрытия видео
  function closeVideoModal() {
    if (currentVideoIframe) {
      currentVideoIframe.remove();
      currentVideoIframe = null;
    }
    videoModal.style.display = 'none';
  }

  // Загрузка категорий
  async function loadCategories() {
    const loader = document.getElementById('loader');
    try {
      loader.style.display = 'block';
      
      const response = await fetch('/api/categories');
      const data = await response.json();
      
      if (!response.ok) {
        // Обработка кастомных ошибок от сервера
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid categories data format');
      }
      
      displayCategories(data);
    } catch (error) {
      console.error('Categories Load Error:', error);
      showError('Не удалось загрузить категории. Попробуйте обновить страницу.');
      
      // Показываем стандартные категории при ошибке
      displayDefaultCategories();
    } finally {
      loader.style.display = 'none';
    }
  }
  
  function displayDefaultCategories() {
    const defaultCategories = [
      {id: '1', snippet: {title: 'Фильмы', assignable: true}},
      {id: '2', snippet: {title: 'Авто', assignable: true}},
      {id: '10', snippet: {title: 'Музыка', assignable: true}},
      {id: '15', snippet: {title: 'Животные', assignable: true}},
      {id: '17', snippet: {title: 'Спорт', assignable: true}},
      {id: '20', snippet: {title: 'Игры', assignable: true}}
    ];
    
    displayCategories(defaultCategories);
  }
  
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <p>${message}</p>
      <button onclick="location.reload()">Обновить</button>
    `;
    
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    container.appendChild(errorDiv);
  }
  function displayCategories(categories) {
    categoriesContainer.innerHTML = `
      <div class="categories-list">
        ${categories.map(cat => `
          <div class="category-item" data-category-id="${cat.id}">
            <div class="category-icon">${cat.snippet.title.charAt(0)}</div>
            <span>${cat.snippet.title}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    // Добавляем обработчики кликов для категорий
    document.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', () => {
        const categoryId = item.dataset.categoryId;
        currentCategoryId = categoryId;
        currentChannelId = '';
        currentSearchTerm = '';
        loadCategoryVideos(categoryId);
      });
    });
  }

  // Загрузка видео по категории
  async function loadCategoryVideos(categoryId, pageToken = '') {
    try {
      showLoader();
      if (!pageToken) clearResults();
      
      const response = await fetch(`/api/category/${categoryId}?pageToken=${pageToken}`);
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить видео категории');
      }
      
      const data = await response.json();
      
      if (pageToken) {
        appendResults(data);
      } else {
        displayResults(data);
      }
      
      toggleLoadMoreButton(!!data.nextPageToken);
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoader();
    }
  }

  // Загрузка популярных видео
  async function loadPopularVideos(pageToken = '') {
    try {
      showLoader();
      if (!pageToken) {
        clearResults();
        currentCategoryId = '';
        currentChannelId = '';
        currentSearchTerm = '';
      }
      
      const response = await fetch(`/api/popular?pageToken=${pageToken}`);
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить популярные видео');
      }
      
      const data = await response.json();
      
      if (pageToken) {
        appendResults(data);
      } else {
        displayResults(data);
      }
      
      toggleLoadMoreButton(!!data.nextPageToken);
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoader();
    }
  }

  // Поиск видео
  async function searchVideos(searchTerm, pageToken = '') {
    try {
      showLoader();
      if (!pageToken) {
        clearResults();
        currentCategoryId = '';
        currentChannelId = '';
      }
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}&pageToken=${pageToken}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при поиске видео');
      }
      
      const data = await response.json();
      
      nextPageToken = data.nextPageToken || '';
      prevPageToken = data.prevPageToken || '';
      
      if (pageToken) {
        appendResults(data.items);
      } else {
        displayResults(data.items);
      }
      
      toggleLoadMoreButton(!!nextPageToken);
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoader();
    }
  }

  // Получение деталей видео
  async function getVideoDetails(videoId) {
    try {
      showLoader();
      
      const response = await fetch(`/api/video/${videoId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке видео');
      }
      
      const videoData = await response.json();
      showVideoModal(videoData);
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoader();
    }
  }
  
    function updatePagination() {
      const paginationContainer = document.querySelector('.pagination-container');
      if (!paginationContainer) return;
      
      paginationContainer.innerHTML = '';
      
      if (totalPages <= 1) return;
    
      const pagination = document.createElement('div');
      pagination.className = 'pagination';
    
      // Кнопка "Назад"
      const prevButton = document.createElement('button');
      prevButton.innerHTML = '&laquo;';
      prevButton.disabled = currentPage === 1;
      prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
          loadChannelVideos(currentChannelId, currentPage - 1);
        }
      });
    // Номера страниц
  const pagesContainer = document.createElement('div');
  pagesContainer.className = 'pages';

  // Показываем до 5 страниц вокруг текущей
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.textContent = i;
    if (i === currentPage) {
      pageButton.classList.add('active');
    }
    pageButton.addEventListener('click', () => {
      loadChannelVideos(currentChannelId, i);
    });
    pagesContainer.appendChild(pageButton);
  }

  // Кнопка "Вперед"
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '&raquo;';
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      loadChannelVideos(currentChannelId, currentPage + 1);
    }
  });

  pagination.appendChild(prevButton);
  pagination.appendChild(pagesContainer);
  pagination.appendChild(nextButton);
  paginationContainer.appendChild(pagination);
}
  
  function createPageButton(pageNumber) {
    const button = document.createElement('button');
    button.textContent = pageNumber;
    if (pageNumber === currentPage) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      currentPage = pageNumber;
      loadPage();
    });
    return button;
  }
  
  function loadPage() {
    if (currentChannelId) {
      loadChannelVideos(currentChannelId, currentPage > 1 ? nextPageToken : '');
    }
    // Add similar logic for other page types if needed
  }
  // Получение видео канала
  // Обновите функцию loadChannelVideos
async function loadChannelVideos(channelId, page = 1) {
  try {
    showLoader();
    currentChannelId = channelId;
    currentPage = page;
    
    // Используем сохраненный pageToken или пустую строку для первой страницы
    const pageToken = page === 1 ? '' : pageTokens[page] || '';
    
    const response = await fetch(`/api/channel/${channelId}?pageToken=${pageToken}`);
    const data = await response.json();
    
    // Сохраняем токен для следующей страницы
    if (data.nextPageToken) {
      pageTokens[page + 1] = data.nextPageToken;
    }
    
    // Рассчитываем общее количество страниц
    totalPages = Math.ceil(data.totalVideos / 12);
    
    displayChannelVideos(data, page === 1);
    updatePagination();
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

  // Отображение результатов
  function displayResults(videos) {
    if (!videos || videos.length === 0) {
      resultsContainer.innerHTML = '<p class="no-results">Видео не найдены. Попробуйте другой запрос.</p>';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="videos-grid">
        ${videos.map(video => createVideoCard(video)).join('')}
      </div>
    `;
    
    addVideoClickHandlers();
    addChannelClickHandlers();
  }

  // Добавление результатов (для пагинации)
  function appendResults(videos) {
    if (!videos || videos.length === 0) return;
    
    const videosGrid = resultsContainer.querySelector('.videos-grid') || resultsContainer;
    const newCards = videos.map(video => createVideoCard(video)).join('');
    videosGrid.insertAdjacentHTML('beforeend', newCards);
    
    addVideoClickHandlers();
    addChannelClickHandlers();
  }

  // Отображение видео канала
  function displayChannelVideos(channelData, showHeader = true) {
    const { channelInfo, videos } = channelData;
    
    resultsContainer.innerHTML = `
      ${showHeader ? `
        <div class="channel-header">
          <img src="${channelInfo.snippet.thumbnails?.medium?.url || 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj'}" 
               alt="${channelInfo.snippet.title}" 
               class="channel-avatar"
               onerror="this.src='https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj'">
          <div class="channel-info">
            <h2>${channelInfo.snippet.title}</h2>
            <p class="channel-stats">
              <span>${parseInt(channelInfo.statistics?.subscriberCount || 0).toLocaleString()} подписчиков</span>
              <span>${parseInt(channelInfo.statistics?.videoCount || 0).toLocaleString()} видео</span>
            </p>
            <p class="channel-description">${channelInfo.snippet.description || ''}</p>
          </div>
        </div>
      ` : ''}
      <div class="channel-videos">
        <h3>${showHeader ? 'Последние видео' : 'Еще видео'}</h3>
        <div class="videos-grid">
          ${videos.map(video => createVideoCard(video)).join('')}
        </div>
        <div class="pagination-container"></div>
      </div>
    `;
    
    addVideoClickHandlers();
    updatePagination();
  }

  // Создание карточки видео
  function createVideoCard(video) {
    const videoId = video.id.videoId || video.id;
    const channelThumbnail = video.channelThumbnail || 
                           (video.channelInfo?.snippet?.thumbnails?.default?.url || 
                           'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj');
    
    return `
      <div class="video-card">
        <div class="video-thumbnail-container" data-video-id="${videoId}">
          <img class="video-thumbnail" src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
          ${video.contentDetails ? `<div class="video-duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
        </div>
        <div class="video-info">
          <div class="channel-avatar-small" data-channel-id="${video.snippet.channelId}">
            <img src="${channelThumbnail}" 
                 alt="${video.snippet.channelTitle}" 
                 onerror="this.src='https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj'">
          </div>
          <div class="video-details">
            <h3 class="video-title" data-video-id="${videoId}">${video.snippet.title}</h3>
            <p class="video-channel" data-channel-id="${video.snippet.channelId}">${video.snippet.channelTitle}</p>
            <p class="video-stats">
              ${video.statistics ? `
                <span>${formatNumber(video.statistics.viewCount)} просмотров</span>
                ${video.statistics.likeCount ? `<span>${formatNumber(video.statistics.likeCount)} лайков</span>` : ''}
              ` : ''}
            </p>
          </div>
        </div>
      </div>
    `;
}

// Вспомогательная функция для форматирования чисел
function formatNumber(num) {
  return parseInt(num || 0).toLocaleString();
}

  // Обработчики кликов по видео
  function addVideoClickHandlers() {
    document.querySelectorAll('[data-video-id]').forEach(element => {
      element.addEventListener('click', (e) => {
        if (e.target.closest('.channel-avatar-small') || e.target.closest('.video-channel')) return;
        const videoId = element.closest('[data-video-id]').dataset.videoId;
        getVideoDetails(videoId);
      });
    });
  }

  // Обработчики кликов по каналам
  function addChannelClickHandlers() {
    document.querySelectorAll('[data-channel-id]').forEach(element => {
      if (element.classList.contains('channel-avatar-small') || element.classList.contains('video-channel')) {
        element.addEventListener('click', (e) => {
          e.stopPropagation();
          const channelId = element.dataset.channelId;
          loadChannelVideos(channelId);
        });
      }
    });
  }

  // Показ модального окна с видео
  function showVideoModal(videoData) {
    closeVideoModal();
    
    modalContent.innerHTML = `
      <div class="modal-video-container">
        <div class="video-wrapper">
          <iframe id="ytPlayer" width="100%" height="400" 
                  src="https://www.youtube.com/embed/${videoData.id}?autoplay=1&enablejsapi=1" 
                  frameborder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowfullscreen></iframe>
        </div>
        <div class="modal-video-info">
          <div class="modal-channel-info" data-channel-id="${videoData.snippet.channelId}">
            <img src="${videoData.channelInfo?.snippet?.thumbnails?.default?.url || ''}" 
                 alt="${videoData.channelInfo?.snippet?.title || ''}" 
                 class="modal-channel-avatar">
            <div>
              <h3>${videoData.channelInfo?.snippet?.title || videoData.snippet.channelTitle}</h3>
              <p>Подписчиков: ${videoData.channelInfo?.statistics?.subscriberCount ? parseInt(videoData.channelInfo.statistics.subscriberCount).toLocaleString() : 'Н/Д'}</p>
            </div>
          </div>
          <h2>${videoData.snippet.title}</h2>
          <p class="video-stats">
            <span>👁️ ${parseInt(videoData.statistics.viewCount).toLocaleString()} просмотров</span>
            <span>👍 ${parseInt(videoData.statistics.likeCount).toLocaleString()}</span>
            <span>📅 ${new Date(videoData.snippet.publishedAt).toLocaleDateString('ru-RU')}</span>
          </p>
          <p class="video-description">${videoData.snippet.description}</p>
        </div>
      </div>
    `;
    
    currentVideoIframe = document.getElementById('ytPlayer');
    videoModal.style.display = 'block';
    
    // Добавляем обработчик для клика по каналу в модальном окне
    document.querySelector('.modal-channel-info').addEventListener('click', (e) => {
      const channelId = e.currentTarget.dataset.channelId;
      closeVideoModal();
      loadChannelVideos(channelId);
    });
  }

  // Форматирование длительности видео
  function formatDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] ? parseInt(match[1]) : 0);
    const minutes = (match[2] ? parseInt(match[2]) : 0);
    const seconds = (match[3] ? parseInt(match[3]) : 0);
    
    // Если видео меньше минуты
  if (hours === 0 && minutes === 0) {
    return `0:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Если видео меньше часа
  if (hours === 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Для видео длиннее часа
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Вспомогательные функции
  function clearResults() {
    resultsContainer.innerHTML = '';
    loadMoreBtn.style.display = 'none';
  }

  function showLoader() {
    loader.style.display = 'block';
  }

  function hideLoader() {
    loader.style.display = 'none';
  }

  function showError(message) {
    resultsContainer.innerHTML = `
      <div class="error-message">
        <p>${message}</p>
        <button onclick="window.location.reload()">Попробовать снова</button>
      </div>
    `;
  }

  function toggleLoadMoreButton(show) {
    loadMoreBtn.style.display = show ? 'block' : 'none';
    if (show) {
      loadMoreBtn.textContent = currentChannelId ? 'Загрузить еще видео' : 'Загрузить еще';
    }
  }
});