import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- Users ---
  const adminHash = await bcrypt.hash('admin1234', 12);
  const profHash = await bcrypt.hash('prof1234', 12);
  const memberHash = await bcrypt.hash('member1234', 12);

  const admin = await prisma.appUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      fullName: 'Lab Administrator',
      role: 'super_admin',
      active: true,
    },
  });

  const professor = await prisma.appUser.upsert({
    where: { username: 'professor' },
    update: {},
    create: {
      username: 'professor',
      passwordHash: profHash,
      fullName: 'Professor Cho',
      role: 'professor',
      active: true,
    },
  });

  const member = await prisma.appUser.upsert({
    where: { username: 'member1' },
    update: {},
    create: {
      username: 'member1',
      passwordHash: memberHash,
      fullName: 'Demo Member',
      role: 'member',
      active: true,
    },
  });

  console.log('Users created');

  // --- Rooms ---
  const room2104 = await prisma.room.upsert({
    where: { id: 'room-2104' },
    update: {},
    create: { id: 'room-2104', name: 'Room 2104', ordering: 1 },
  });

  const room2104Cameras = await prisma.room.upsert({
    where: { id: 'room-2104-cameras' },
    update: {},
    create: { id: 'room-2104-cameras', name: 'Cameras', parentId: room2104.id, ordering: 1 },
  });

  const room2104Spec = await prisma.room.upsert({
    where: { id: 'room-2104-spec' },
    update: {},
    create: { id: 'room-2104-spec', name: 'Spectrometers', parentId: room2104.id, ordering: 2 },
  });

  const room2105 = await prisma.room.upsert({
    where: { id: 'room-2105' },
    update: {},
    create: { id: 'room-2105', name: 'Room 2105', ordering: 2 },
  });

  const room2105Cameras = await prisma.room.upsert({
    where: { id: 'room-2105-cameras' },
    update: {},
    create: { id: 'room-2105-cameras', name: 'Cameras', parentId: room2105.id, ordering: 1 },
  });

  const room2105Chambers = await prisma.room.upsert({
    where: { id: 'room-2105-chambers' },
    update: {},
    create: { id: 'room-2105-chambers', name: 'Chambers', parentId: room2105.id, ordering: 2 },
  });

  const plantFactory = await prisma.room.upsert({
    where: { id: 'room-plant-factory' },
    update: {},
    create: { id: 'room-plant-factory', name: 'Plant Factory', ordering: 3 },
  });

  const growthChamber = await prisma.room.upsert({
    where: { id: 'room-growth-chamber' },
    update: {},
    create: { id: 'room-growth-chamber', name: 'Growth Chamber', parentId: plantFactory.id, ordering: 3 },
  });

  const servers = await prisma.room.upsert({
    where: { id: 'room-servers' },
    update: {},
    create: { id: 'room-servers', name: 'Shared Lab Servers', ordering: 4 },
  });

  for (const [id, name, parentId, ordering] of [
    ['room-plant-1', 'Room 1', plantFactory.id, 1],
    ['room-plant-2', 'Room 2', plantFactory.id, 2],
    ['room-chamber-1', 'Chamber 1', growthChamber.id, 1],
    ['room-chamber-2', 'Chamber 2', growthChamber.id, 2],
    ['room-server-1', 'Server 1', servers.id, 1],
    ['room-server-2', 'Server 2', servers.id, 2],
    ['room-server-3', 'Server 3', servers.id, 3],
  ] as [string, string, string, number][]) {
    await prisma.room.upsert({
      where: { id },
      update: {},
      create: { id, name, parentId, ordering },
    });
  }

  console.log('Rooms created');

  // --- Equipment ---
  const equipmentData = [
    { id: 'eq-visnir-headwall', name: 'VisNIR – Headwall (Hyperspectral Imaging Camera)', category: 'Camera', roomId: room2104Cameras.id },
    { id: 'eq-swir-headwall', name: 'SWIR – Headwall', category: 'Camera', roomId: room2104Cameras.id },
    { id: 'eq-rgb-canon', name: 'RGB – Canon', category: 'Camera', roomId: room2104Cameras.id },
    { id: 'eq-ftir', name: 'FT-IR Spectrometer', category: 'Spectrometer', roomId: room2104Spec.id },
    { id: 'eq-ftnir', name: 'FT-NIR Spectrometer', category: 'Spectrometer', roomId: room2104Spec.id },
    { id: 'eq-raman', name: 'Raman Spectrometer', category: 'Spectrometer', roomId: room2104Spec.id },
    { id: 'eq-fluorescence', name: 'Fluorescence Spectrometer', category: 'Spectrometer', roomId: room2104Spec.id },
    { id: 'eq-visnir-2105', name: 'VisNIR Camera (2105)', category: 'Camera', roomId: room2105Cameras.id },
    { id: 'eq-micro-hsi', name: 'Micro HSI Camera', category: 'Camera', roomId: room2105Cameras.id },
    { id: 'eq-robot-chamber', name: 'Robot Phenotyping Chamber', category: 'Chamber', roomId: room2105Chambers.id },
    { id: 'eq-space-chamber', name: 'Space Simulation Chamber', category: 'Chamber', roomId: room2105Chambers.id },
  ];

  for (const eq of equipmentData) {
    await prisma.equipment.upsert({
      where: { id: eq.id },
      update: {},
      create: { ...eq, createdBy: admin.id, requiresApproval: false },
    });
  }

  console.log('Equipment created');

  // --- Sample announcement ---
  await prisma.announcement.upsert({
    where: { id: 'ann-welcome' },
    update: {},
    create: {
      id: 'ann-welcome',
      title: 'Welcome to NDBSL Lab System',
      content: 'This is the new NDBSL Laboratory Management System. You can book equipment, submit procurement requests, and manage lab resources from this portal.',
      visible: true,
      createdBy: admin.id,
    },
  });

  // --- Sample research project ---
  await prisma.researchProject.upsert({
    where: { id: 'research-hyperspectral' },
    update: {},
    create: {
      id: 'research-hyperspectral',
      title: 'Hyperspectral Imaging for Plant Phenotyping',
      researchType: 'current',
      summary: 'Developing nondestructive hyperspectral imaging techniques for rapid plant phenotyping in controlled environments.',
      leadResearcher: 'Prof. B.K. Cho',
      year: 2025,
      displayOrder: 1,
      createdBy: admin.id,
    },
  });

  await prisma.researchProject.upsert({
    where: { id: 'research-food-safety' },
    update: {},
    create: {
      id: 'research-food-safety',
      title: 'Near-Infrared Spectroscopy for Food Quality Assessment',
      researchType: 'completed',
      summary: 'Applied NIR spectroscopy to develop rapid, nondestructive methods for assessing food quality parameters.',
      leadResearcher: 'Prof. B.K. Cho',
      year: 2023,
      displayOrder: 1,
      createdBy: admin.id,
    },
  });

  console.log('Sample data created');
  console.log('\nSeed complete!');
  console.log('\nDefault accounts:');
  console.log('  admin    / admin1234   (super_admin)');
  console.log('  professor / prof1234   (professor)');
  console.log('  member1  / member1234  (member)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
