const path = window.location.pathname.replace(/\/+$/, '');
export const isLabPage = path === '/lab/kmeans' || path === '/lab';
export const LAB_URL = '/lab/kmeans';
