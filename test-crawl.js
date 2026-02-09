/**
 * Simple test script for the crawl engine
 */

import { crawl } from './dist/crawler/engine.js';
import { logger } from './dist/utils/logger.js';

async function testCrawl() {
    console.log('Testing crawl engine...\n');

    const result = await crawl({
        startUrl: 'https://example.com',
        strategy: 'domain',
        maxDepth: 2,
        maxPages: 5,
        concurrency: 2,
        timeout: 10000,
    });

    console.log('\n=== CRAWL RESULTS ===');
    console.log(`Pages scraped: ${result.pagesScraped}`);
    console.log(`Links discovered: ${result.linksDiscovered}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`\nPages found:`);
    result.pages.forEach((page, idx) => {
        console.log(`  ${idx + 1}. ${page.url} (depth: ${page.depth})`);
    });

    if (result.errors.length > 0) {
        console.log(`\nErrors:`);
        result.errors.forEach((err) => {
            console.log(`  - ${err.url}: ${err.error}`);
        });
    }
}

testCrawl().catch((err) => {
    logger.error('Test failed', err);
    process.exit(1);
});
