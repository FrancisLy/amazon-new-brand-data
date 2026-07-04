const axios = require('axios');

async function fetchWaywardBrands(apiKey) {
  const brands = [];
  let pageNumber = 1;
  const pageSize = 200;
  let totalPages = 1;
  let totalBrands = 0;
  const maxRetries = 3;

  const axiosInstance = axios.create({
    timeout: 30000,
    headers: {
      'X-Api-Key': apiKey
    }
  });

  async function fetchWithRetry(url, retries = maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await axiosInstance.get(url);
      } catch (error) {
        if (attempt === retries) throw error;
        console.log(`Wayward: 第${attempt}次重试 (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  try {
    while (true) {
      const url = new URL('https://api.wayward.com/creator/v1/brands');
      url.searchParams.set('page_number', pageNumber);
      url.searchParams.set('page_size', pageSize);

      const response = await fetchWithRetry(url.toString());
      const data = response.data;

      if (!data || !data.brands || data.brands.length === 0) {
        break;
      }

      if (pageNumber === 1) {
        totalPages = data.totalPages || 1;
        totalBrands = data.totalBrands || 0;
        console.log(`Wayward: 共 ${totalBrands} 个商家，需要 ${totalPages} 页`);
      }

      brands.push(...data.brands.map(b => ({
        id: b.id,
        name: b.name,
        url: ''
      })));

      if (pageNumber >= totalPages) {
        break;
      }
      pageNumber++;

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`Wayward: 获取到 ${brands.length} 个商家`);
    return brands;
  } catch (error) {
    console.error('Wayward API请求失败:', error.message);
    // 返回已获取的部分数据，而不是完全失败
    if (brands.length > 0) {
      console.log(`Wayward: 返回已获取的 ${brands.length} 个商家（部分数据）`);
      return brands;
    }
    throw error;
  }
}

module.exports = { fetchWaywardBrands };
