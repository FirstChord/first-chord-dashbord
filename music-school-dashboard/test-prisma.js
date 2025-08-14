// Test Prisma client with proper path resolution
const path = require('path');
const { PrismaClient } = require('./lib/generated/prisma');

console.log('Current working directory:', process.cwd());
console.log('Database path:', path.join(process.cwd(), 'data', 'school.db'));

const prisma = new PrismaClient();

async function testPrisma() {
  try {
    const studentCount = await prisma.students.count();
    console.log('✅ Prisma connection successful! Student count:', studentCount);
    
    const tutorCount = await prisma.tutors.count();
    console.log('✅ Tutor count:', tutorCount);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Prisma connection failed:', error.message);
    await prisma.$disconnect();
  }
}

testPrisma();
