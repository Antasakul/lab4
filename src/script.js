document.addEventListener('DOMContentLoaded', () => {
  // Конфигурация
  const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY; // Замените на свой ключ
  const DEFAULT_AVATAR = 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj';
  
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
  
  // Состояние приложения
  let currentSearchTerm = '';
  let nextPageToken = '';
  let prevPageToken = '';
  let currentVideoIframe = null;
  let currentLanguage = 'ru';
  let currentChannelId = '';
  let currentCategoryId = '';
  let currentPage = 1;
  let totalPages = 1;

  // Инициализация
  initApp();

  async function initApp() {
    await loadCategories();
    loadPopularVideos();
  }

  // ==================== YouTube API функции ====================

  async function fetchYouTubeAPI(endpoint, params = {}) {
    const baseUrl = 'https://www.googleapis.com/youtube/v3/';
    const queryParams = new URLSearchParams({
      ...params,
      key: API_KEY,
      hl: currentLanguage,
      regionCode: 'RU'
    });
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}?${queryParams}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('YouTube API Error:', error);
      throw error;
    }
  }

  async function getPopularVideos(pageToken = '') {
    return fetchYouTubeAPI('videos', {
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      maxResults: 12,
      pageToken
    });
  }

  async function getVideosByCategory(categoryId, pageToken = '') {
    return fetchYouTubeAPI('videos', {
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      videoCategoryId: categoryId,
      maxResults: 12,
      pageToken
    });
  }

  async function searchVideos(query, pageToken = '') {
    return fetchYouTubeAPI('search', {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: 12,
      pageToken
    });
  }

  async function getVideoDetails(videoId) {
    return fetchYouTubeAPI('videos', {
      part: 'snippet,contentDetails,statistics',
      id: videoId
    });
  }

  async function getChannelInfo(channelId) {
    return fetchYouTubeAPI('channels', {
      part: 'snippet,statistics',
      id: channelId
    });
  }

  async function getChannelVideos(channelId, pageToken = '') {
    const [channelInfo, videos] = await Promise.all([
      getChannelInfo(channelId),
      fetchYouTubeAPI('search', {
        part: 'snippet',
        channelId,
        maxResults: 12,
        order: 'date',
        type: 'video',
        pageToken
      })
    ]);

    const videoIds = videos.items.map(item => item.id.videoId).join(',');
    const videosStats = videoIds ? await fetchYouTubeAPI('videos', {
      part: 'statistics,contentDetails',
      id: videoIds
    }) : { items: [] };

    return {
      channelInfo: channelInfo.items[0],
      videos: videos.items.map((item, index) => ({
        ...item,
        statistics: videosStats.items[index]?.statistics,
        contentDetails: videosStats.items[index]?.contentDetails,
        channelThumbnail: channelInfo.items[0]?.snippet?.thumbnails?.default?.url || DEFAULT_AVATAR
      })),
      nextPageToken: videos.nextPageToken,
      prevPageToken: videos.prevPageToken,
      totalVideos: channelInfo.items[0]?.statistics?.videoCount || 0
    };
  }

  async function getVideoCategories() {
    const response = await fetchYouTubeAPI('videoCategories', {
      part: 'snippet',
      regionCode: 'RU'
    });

    const excludedCategories = [19, 27]; // Путешествия и Образование
    return response.items
      .filter(cat => cat.snippet && cat.snippet.assignable && !excludedCategories.includes(parseInt(cat.id)))
      .map(category => ({
        id: category.id,
        snippet: {
          title: category.snippet.title.replace(/&amp;/g, '&'),
          assignable: category.snippet.assignable
        }
      }));
  }

  // ==================== Обработчики событий ====================

  searchButton.addEventListener('click', () => {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return showError('Введите поисковый запрос');
    currentSearchTerm = searchTerm;
    performSearch(searchTerm);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchButton.click();
  });

  loadMoreBtn.addEventListener('click', () => {
    if (currentChannelId) {
      loadChannelVideos(currentChannelId, nextPageToken);
    } else if (currentCategoryId) {
      loadCategoryVideos(currentCategoryId, nextPageToken);
    } else if (currentSearchTerm) {
      performSearch(currentSearchTerm, nextPageToken);
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
      performSearch(currentSearchTerm);
    } else if (currentChannelId) {
      loadChannelVideos(currentChannelId);
    } else if (currentCategoryId) {
      loadCategoryVideos(currentCategoryId);
    } else {
      loadPopularVideos();
    }
  });

  closeModal.addEventListener('click', closeVideoModal);
  window.addEventListener('click', (e) => e.target === videoModal && closeVideoModal());

  // ==================== Основные функции ====================

  async function loadCategories() {
    try {
      showLoader();
      const categories = await getVideoCategories();
      displayCategories(categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
      displayDefaultCategories();
    } finally {
      hideLoader();
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

    document.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', () => {
        currentCategoryId = item.dataset.categoryId;
        currentChannelId = '';
        currentSearchTerm = '';
        loadCategoryVideos(currentCategoryId);
      });
    });
  }

  async function loadPopularVideos(pageToken = '') {
    try {
      showLoader();
      if (!pageToken) clearResults();

      const data = await getPopularVideos(pageToken);
      const videosWithChannels = await enrichVideosWithChannelInfo(data.items);
      
      if (pageToken) {
        appendResults(videosWithChannels);
      } else {
        displayResults(videosWithChannels);
      }

      nextPageToken = data.nextPageToken || '';
      toggleLoadMoreButton(!!nextPageToken);
    } catch (error) {
      showError('Не удалось загрузить популярные видео: ' + error.message);
    } finally {
      hideLoader();
    }
  }

  async function loadCategoryVideos(categoryId, pageToken = '') {
    try {
      showLoader();
      if (!pageToken) clearResults();

      const data = await getVideosByCategory(categoryId, pageToken);
      const videosWithChannels = await enrichVideosWithChannelInfo(data.items);
      
      if (pageToken) {
        appendResults(videosWithChannels);
      } else {
        displayResults(videosWithChannels);
      }

      nextPageToken = data.nextPageToken || '';
      toggleLoadMoreButton(!!nextPageToken);
    } catch (error) {
      showError('Не удалось загрузить видео категории: ' + error.message);
    } finally {
      hideLoader();
    }
  }

  async function performSearch(query, pageToken = '') {
    try {
      showLoader();
      if (!pageToken) clearResults();

      const searchData = await searchVideos(query, pageToken);
      const videosWithChannels = await enrichVideosWithChannelInfo(searchData.items);
      
      if (pageToken) {
        appendResults(videosWithChannels);
      } else {
        displayResults(videosWithChannels);
      }

      nextPageToken = searchData.nextPageToken || '';
      prevPageToken = searchData.prevPageToken || '';
      toggleLoadMoreButton(!!nextPageToken);
    } catch (error) {
      showError('Ошибка поиска: ' + error.message);
    } finally {
      hideLoader();
    }
  }

  async function loadChannelVideos(channelId, pageToken = '') {
    try {
      showLoader();
      if (!pageToken) clearResults();

      const channelData = await getChannelVideos(channelId, pageToken);
      displayChannelVideos(channelData, !pageToken);
      
      nextPageToken = channelData.nextPageToken || '';
      toggleLoadMoreButton(!!nextPageToken);
    } catch (error) {
      showError('Не удалось загрузить видео канала: ' + error.message);
    } finally {
      hideLoader();
    }
  }

  async function showVideoDetails(videoId) {
    try {
      showLoader();
      const videoData = await getVideoDetails(videoId);
      
      if (!videoData.items || videoData.items.length === 0) {
        throw new Error('Видео не найдено');
      }

      const video = videoData.items[0];
      const channelInfo = await getChannelInfo(video.snippet.channelId);
      
      showVideoModal({
        ...video,
        channelInfo: channelInfo.items[0] || null
      });
    } catch (error) {
      showError('Не удалось загрузить видео: ' + error.message);
    } finally {
      hideLoader();
    }
  }

  // ==================== Вспомогательные функции ====================

  async function enrichVideosWithChannelInfo(videos) {
    return Promise.all(videos.map(async video => {
      const channelId = video.snippet?.channelId;
      let channelInfo = null;
      
      try {
        if (channelId) {
          const channelData = await getChannelInfo(channelId);
          channelInfo = channelData.items[0];
        }
      } catch (error) {
        console.error('Error fetching channel info:', error);
      }

      return {
        ...video,
        channelInfo: channelInfo || {
          snippet: {
            thumbnails: { default: { url: DEFAULT_AVATAR } },
            title: video.snippet?.channelTitle || 'Unknown Channel'
          }
        }
      };
    }));
  }

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

  function displayChannelVideos(channelData, showHeader = true) {
    resultsContainer.innerHTML = `
      ${showHeader ? createChannelHeader(channelData.channelInfo) : ''}
      <div class="channel-videos">
        <h3>${showHeader ? 'Последние видео' : 'Еще видео'}</h3>
        <div class="videos-grid">
          ${channelData.videos.map(video => createVideoCard(video)).join('')}
        </div>
      </div>
    `;
    
    addVideoClickHandlers();
    addChannelClickHandlers();
  }

  function createChannelHeader(channelInfo) {
    return `
      <div class="channel-header">
        <img src="${channelInfo.snippet.thumbnails?.medium?.url || DEFAULT_AVATAR}" 
             alt="${channelInfo.snippet.title}" 
             class="channel-avatar"
             onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="channel-info">
          <h2>${channelInfo.snippet.title}</h2>
          <p class="channel-stats">
            <span>${parseInt(channelInfo.statistics?.subscriberCount || 0).toLocaleString()} подписчиков</span>
            <span>${parseInt(channelInfo.statistics?.videoCount || 0).toLocaleString()} видео</span>
          </p>
          <p class="channel-description">${channelInfo.snippet.description || ''}</p>
        </div>
      </div>
    `;
  }

  function createVideoCard(video) {
    const videoId = video.id.videoId || video.id;
    const duration = video.contentDetails?.duration ? formatDuration(video.contentDetails.duration) : '';
    const views = video.statistics?.viewCount ? formatNumber(video.statistics.viewCount) : '0';
    
    return `
      <div class="video-card">
        <div class="video-thumbnail-container" data-video-id="${videoId}">
          <img class="video-thumbnail" src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
          ${duration ? `<div class="video-duration">${duration}</div>` : ''}
        </div>
        <div class="video-info">
          <div class="channel-avatar-small" data-channel-id="${video.snippet.channelId}">
            <img src="${video.channelInfo?.snippet?.thumbnails?.default?.url || DEFAULT_AVATAR}" 
                 alt="${video.snippet.channelTitle}" 
                 onerror="this.src='${DEFAULT_AVATAR}'">
          </div>
          <div class="video-details">
            <h3 class="video-title" data-video-id="${videoId}">${video.snippet.title}</h3>
            <p class="video-channel" data-channel-id="${video.snippet.channelId}">${video.snippet.channelTitle}</p>
            <p class="video-stats">
              <span>${views} просмотров</span>
              ${video.statistics?.likeCount ? `<span>${formatNumber(video.statistics.likeCount)} лайков</span>` : ''}
            </p>
          </div>
        </div>
      </div>
    `;
  }

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
            <img src="${videoData.channelInfo?.snippet?.thumbnails?.default?.url || DEFAULT_AVATAR}" 
                 alt="${videoData.channelInfo?.snippet?.title || videoData.snippet.channelTitle}" 
                 class="modal-channel-avatar">
            <div>
              <h3>${videoData.channelInfo?.snippet?.title || videoData.snippet.channelTitle}</h3>
              <p>Подписчиков: ${videoData.channelInfo?.statistics?.subscriberCount ? formatNumber(videoData.channelInfo.statistics.subscriberCount) : 'Н/Д'}</p>
            </div>
          </div>
          <h2>${videoData.snippet.title}</h2>
          <p class="video-stats">
            <span>👁️ ${formatNumber(videoData.statistics.viewCount)} просмотров</span>
            <span>👍 ${formatNumber(videoData.statistics.likeCount)}</span>
            <span>📅 ${new Date(videoData.snippet.publishedAt).toLocaleDateString('ru-RU')}</span>
          </p>
          <p class="video-description">${videoData.snippet.description}</p>
        </div>
      </div>
    `;
    
    currentVideoIframe = document.getElementById('ytPlayer');
    videoModal.style.display = 'block';
    
    document.querySelector('.modal-channel-info').addEventListener('click', (e) => {
      const channelId = e.currentTarget.dataset.channelId;
      closeVideoModal();
      loadChannelVideos(channelId);
    });
  }

  function addVideoClickHandlers() {
    document.querySelectorAll('[data-video-id]').forEach(element => {
      element.addEventListener('click', (e) => {
        if (e.target.closest('.channel-avatar-small') || e.target.closest('.video-channel')) return;
        const videoId = element.closest('[data-video-id]').dataset.videoId;
        showVideoDetails(videoId);
      });
    });
  }

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

  function closeVideoModal() {
    if (currentVideoIframe) {
      currentVideoIframe.remove();
      currentVideoIframe = null;
    }
    videoModal.style.display = 'none';
  }

  function formatDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function formatNumber(num) {
    return parseInt(num || 0).toLocaleString();
  }

  function clearResults() {
    resultsContainer.innerHTML = '';
  }

  function appendResults(videos) {
    const videosGrid = resultsContainer.querySelector('.videos-grid') || resultsContainer;
    videosGrid.insertAdjacentHTML('beforeend', videos.map(video => createVideoCard(video)).join(''));
    addVideoClickHandlers();
    addChannelClickHandlers();
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
  }
});