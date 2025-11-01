import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
    max: 10,
    ttl: 1000 * 60 * 60
});
export default cache;
