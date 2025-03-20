// Script to check the user schema and indexes
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/webhash-pro';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    const usersCollection = db.collection('users');
    const userSample = await usersCollection.findOne();
    console.log('User sample:', userSample);
    
    const indexes = await usersCollection.indexes();
    console.log('User collection indexes:', indexes);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

main();
