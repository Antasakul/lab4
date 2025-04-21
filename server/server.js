require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так!' });
});
// В каждом обработчике API, где получаем видео, добавляем полную информацию о канале
// В каждом обработчике API, где получаем видео, добавляем полную информацию о канале
async function getChannelInfo(channelId) {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'snippet',
        id: channelId,
        key: process.env.YOUTUBE_API_KEY
      }
    });
    return response.data.items[0] || null;
  } catch (error) {
    console.error('Error fetching channel info:', error);
    return null;
  }
}

// Обновите обработчики API, чтобы они включали информацию о канале
app.get('/api/popular', async (req, res, next) => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        maxResults: 12,
        regionCode: 'RU',
        key: process.env.YOUTUBE_API_KEY
      }
    });
    
    const videosWithChannel = await Promise.all(
      response.data.items.map(async video => {
        const channelInfo = await getChannelInfo(video.snippet.channelId);
        return {
          ...video,
          channelInfo: channelInfo || {
            snippet: {
              thumbnails: {
                default: { url: 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj' }
              },
              title: video.snippet.channelTitle
            }
          }
        };
      })
    );
    
    res.json(videosWithChannel);
  } catch (error) {
    next(error);
  }
});

// Получение видео по категории
app.get('/api/category/:categoryId', async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        maxResults: 12,
        regionCode: 'RU',
        videoCategoryId: categoryId,
        hl: 'ru',
        key: process.env.YOUTUBE_API_KEY
      }
    });
    
    const videosWithChannel = await Promise.all(
      response.data.items.map(async video => {
        const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet',
            id: video.snippet.channelId,
            key: process.env.YOUTUBE_API_KEY
          }
        });
        
        return {
          ...video,
          channelInfo: channelResponse.data.items[0] || null
        };
      })
    );
    
    res.json(videosWithChannel);
  } catch (error) {
    next(error);
  }
});

// Получение списка категорий
app.get('/api/categories', async (req, res) => {
  const cacheKey = 'yt-categories';
  try {
    // Пробуем получить из кеша
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached categories');
      return res.json(cached);
    }

    console.log('Fetching categories from YouTube API');
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videoCategories', {
      params: {
        part: 'snippet',
        regionCode: 'RU',
        hl: 'ru',
        key: process.env.YOUTUBE_API_KEY
      },
      timeout: 5000
    });

    if (!response.data.items) {
      throw new Error('Invalid response structure from YouTube API');
    }

    // Категории для исключения (Образование - 27, Путешествия - 19)
    const excludedCategories = [19, 27];
    
    const categories = response.data.items
      .filter(cat => {
        try {
          return (
            cat.snippet && 
            cat.snippet.assignable && 
            !excludedCategories.includes(parseInt(cat.id))
          );
        } catch (e) {
          console.warn('Error processing category:', cat, e);
          return false;
        }
      })
      .map(category => ({
        id: category.id,
        snippet: {
          title: category.snippet.title.replace(/&amp;/g, '&'),
          assignable: category.snippet.assignable
        }
      }));

    // Кешируем на 1 час
    cache.set(cacheKey, categories, 3600);
    console.log('Successfully fetched', categories.length, 'categories');
    res.json(categories);
    
  } catch (error) {
    console.error('Categories API Error:', error);
    res.status(500).json({ 
      error: 'Failed to load categories',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// Поиск видео
// Для поиска
app.get('/api/search', async (req, res, next) => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        maxResults: 12,
        q: req.query.q,
        type: 'video',
        key: process.env.YOUTUBE_API_KEY
      }
    });
    
    const itemsWithChannel = await Promise.all(
      response.data.items.map(async item => {
        const channelInfo = await getChannelInfo(item.snippet.channelId);
        return {
          ...item,
          channelInfo: channelInfo || {
            snippet: {
              thumbnails: {
                default: { url: 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj' }
              },
              title: item.snippet.channelTitle
            }
          }
        };
      })
    );
    
    res.json({
      items: itemsWithChannel,
      nextPageToken: response.data.nextPageToken || '',
      prevPageToken: response.data.prevPageToken || ''
    });
  } catch (error) {
    next(error);
  }
});
// Получение деталей видео
app.get('/api/video/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Необходим ID видео' });
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: id,
        key: process.env.YOUTUBE_API_KEY,
        hl: 'ru'
      },
      timeout: 5000
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }
    
    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'snippet,statistics',
        id: response.data.items[0].snippet.channelId,
        key: process.env.YOUTUBE_API_KEY
      }
    });
    
    res.json({
      ...response.data.items[0],
      channelInfo: channelResponse.data.items[0] || null
    });
  } catch (error) {
    next(error);
  }
});

// Получение видео канала с пагинацией
// Получение видео канала с пагинацией
app.get('/api/channel/:channelId', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { pageToken = '' } = req.query;
    
    // Получаем информацию о канале
    const [channelResponse, videosResponse] = await Promise.all([
      axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'snippet,statistics',
          id: channelId,
          key: process.env.YOUTUBE_API_KEY
        }
      }),
      axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          channelId: channelId,
          maxResults: 12,
          order: 'date',
          type: 'video',
          pageToken: pageToken,
          key: process.env.YOUTUBE_API_KEY
        }
      })
    ]);

    // Получаем статистику для видео
    const videoIds = videosResponse.data.items.map(item => item.id.videoId).join(',');
    const videosStats = videoIds ? await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'statistics,contentDetails',
        id: videoIds,
        key: process.env.YOUTUBE_API_KEY
      }
    }) : { data: { items: [] } };

    const videosWithStats = videosResponse.data.items.map((item, index) => ({
      ...item,
      statistics: videosStats.data.items[index]?.statistics,
      contentDetails: videosStats.data.items[index]?.contentDetails,
      channelThumbnail: channelResponse.data.items[0]?.snippet?.thumbnails?.default?.url || 
                       'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj'
    }));

    res.json({
      channelInfo: channelResponse.data.items[0],
      videos: videosWithStats,
      nextPageToken: videosResponse.data.nextPageToken || '',
      prevPageToken: videosResponse.data.prevPageToken || '',
      totalVideos: channelResponse.data.items[0]?.statistics?.videoCount || 0
    });
  } catch (error) {
    next(error);
  }
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});