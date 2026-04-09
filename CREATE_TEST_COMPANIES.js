// Script to create test companies in MongoDB
// Run this with: node CREATE_TEST_COMPANIES.js

const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/attendance', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Company schema (simplified version)
const CompanySchema = new mongoose.Schema({
  name: String,
  code: String,
  isActive: { type: Boolean, default: true },
  address: String,
  location: {
    latitude: Number,
    longitude: Number,
    radius: Number,
  },
  settings: Object,
  operatingHours: Object,
  leaveSettings: Object,
}, { timestamps: true });

const Company = mongoose.model('Company', CompanySchema);

const testCompanies = [
  {
    name: 'Qwegle Tech Solutions',
    code: 'QHR',
    isActive: true,
    address: '123 Tech Street, Bangalore, India',
    location: {
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 500,
    },
    settings: {
      autoCheckIn: true,
      autoCheckOut: true,
      gpsTracking: true,
      workingDays: [1, 2, 3, 4, 5],
      lateThresholdMinutes: 15,
    },
    operatingHours: {
      startTime: '09:00',
      endTime: '18:00',
    },
    leaveSettings: {
      casualLeave: 12,
      sickLeave: 12,
      paidLeave: 18,
      maternityLeave: 180,
      paternityLeave: 15,
    },
  },
  {
    name: 'Test Company 1',
    code: 'TEST1',
    isActive: true,
    address: '456 Test Avenue, Mumbai, India',
    location: {
      latitude: 19.0760,
      longitude: 72.8777,
      radius: 300,
    },
    settings: {
      autoCheckIn: true,
      autoCheckOut: false,
      gpsTracking: true,
      workingDays: [1, 2, 3, 4, 5],
      lateThresholdMinutes: 10,
    },
    operatingHours: {
      startTime: '10:00',
      endTime: '19:00',
    },
    leaveSettings: {
      casualLeave: 10,
      sickLeave: 10,
      paidLeave: 15,
      maternityLeave: 180,
      paternityLeave: 15,
    },
  },
  {
    name: 'Demo Corp',
    code: 'DEMO',
    isActive: true,
    address: '789 Demo Road, Delhi, India',
    location: {
      latitude: 28.7041,
      longitude: 77.1025,
      radius: 400,
    },
    settings: {
      autoCheckIn: false,
      autoCheckOut: false,
      gpsTracking: true,
      workingDays: [1, 2, 3, 4, 5],
      lateThresholdMinutes: 20,
    },
    operatingHours: {
      startTime: '08:30',
      endTime: '17:30',
    },
    leaveSettings: {
      casualLeave: 15,
      sickLeave: 15,
      paidLeave: 20,
      maternityLeave: 180,
      paternityLeave: 15,
    },
  },
  {
    name: 'Innovation Labs',
    code: 'INNO',
    isActive: true,
    address: '321 Innovation Drive, Pune, India',
    location: {
      latitude: 18.5204,
      longitude: 73.8567,
      radius: 600,
    },
    settings: {
      autoCheckIn: true,
      autoCheckOut: true,
      gpsTracking: true,
      workingDays: [1, 2, 3, 4, 5],
      lateThresholdMinutes: 15,
    },
    operatingHours: {
      startTime: '09:30',
      endTime: '18:30',
    },
    leaveSettings: {
      casualLeave: 12,
      sickLeave: 12,
      paidLeave: 18,
      maternityLeave: 180,
      paternityLeave: 15,
    },
  },
  {
    name: 'Global Solutions',
    code: 'GLOBAL',
    isActive: true,
    address: '555 Global Way, Hyderabad, India',
    location: {
      latitude: 17.3850,
      longitude: 78.4867,
      radius: 500,
    },
    settings: {
      autoCheckIn: true,
      autoCheckOut: true,
      gpsTracking: true,
      workingDays: [1, 2, 3, 4, 5, 6],
      lateThresholdMinutes: 15,
    },
    operatingHours: {
      startTime: '09:00',
      endTime: '18:00',
    },
    leaveSettings: {
      casualLeave: 14,
      sickLeave: 14,
      paidLeave: 21,
      maternityLeave: 180,
      paternityLeave: 15,
    },
  },
];

async function createTestCompanies() {
  try {
    console.log('Clearing existing companies...');
    await Company.deleteMany({});
    
    console.log('Creating test companies...');
    const companies = await Company.insertMany(testCompanies);
    
    console.log(`Created ${companies.length} test companies:`);
    companies.forEach(company => {
      console.log(`- ${company.name} (${company.code})`);
    });
    
    console.log('\nTest companies created successfully!');
    console.log('You can now use these companies in the mobile app:');
    console.log('- Qwegle Tech Solutions (QHR)');
    console.log('- Test Company 1 (TEST1)');
    console.log('- Demo Corp (DEMO)');
    console.log('- Innovation Labs (INNO)');
    console.log('- Global Solutions (GLOBAL)');
    
  } catch (error) {
    console.error('Error creating test companies:', error);
  } finally {
    mongoose.disconnect();
  }
}

createTestCompanies();
