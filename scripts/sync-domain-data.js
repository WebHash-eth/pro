// Script to sync ENS domain data with deployment records
// Run with: node scripts/sync-domain-data.js

const fetch = require('node-fetch');

async function syncDomainData() {
  try {
    // Replace with your actual deployment ID
    const deploymentId = '67d314ed2dd46ada05811c9d';
    
    console.log(`Syncing domain data for deployment: ${deploymentId}`);
    
    // Call the sync API endpoint
    const response = await fetch(`http://localhost:3000/api/sync-domains?deploymentId=${deploymentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Sync result:', result);
    console.log('Domain data has been synchronized successfully!');
  } catch (error) {
    console.error('Error syncing domain data:', error);
  }
}

syncDomainData();
