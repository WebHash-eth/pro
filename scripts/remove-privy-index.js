// Script to remove the privyUserId index from MongoDB
const mongoose = require('mongoose');
require('dotenv').config();

async function removePrivyIndex() {
  try {
    // Connect to MongoDB using the connection string from environment variables
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI environment variable is not set');
      process.exit(1);
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully');
    
    // Get a reference to the database
    const db = mongoose.connection.db;
    
    // Get a reference to the users collection
    const usersCollection = db.collection('users');
    
    // List all indexes to find the privyUserId index
    console.log('Listing current indexes...');
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Find the privyUserId index if it exists
    const privyIndex = indexes.find(index => 
      index.key && Object.keys(index.key).includes('privyUserId')
    );
    
    if (privyIndex) {
      console.log(`Found privyUserId index: ${privyIndex.name}`);
      
      // Drop the index
      console.log('Dropping privyUserId index...');
      await usersCollection.dropIndex(privyIndex.name);
      console.log('Successfully dropped privyUserId index');
      
      // Verify the index was dropped
      const updatedIndexes = await usersCollection.indexes();
      console.log('Updated indexes:', JSON.stringify(updatedIndexes, null, 2));
    } else {
      console.log('No privyUserId index found');
    }
    
    console.log('Script completed successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the MongoDB connection
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    process.exit(0);
  }
}

// Run the function
removePrivyIndex();
