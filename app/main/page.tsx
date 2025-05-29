import React, { Suspense } from 'react';
import Loading from '@/components/Loading';
import ErrorBoundary from '@/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { clientPromise } from '@/lib/mongodb';

const HomePageContent = dynamic(() => import('@/components/HomePageContent'), {
  loading: () => <Loading />,
  ssr: true
});

export const metadata: Metadata = {
  title: 'Doctor Finder Bangladesh - Find & Book Doctor Appointments Online',
  description: 'Find the best doctors in Bangladesh. Search by specialty, location, or hospital. Read verified reviews, check qualifications, and book appointments online instantly.',
  keywords: [
    'doctor appointment bangladesh',
    'find doctor bangladesh',
    'book doctor appointment',
    'best doctors dhaka',
    'medical specialists bangladesh',
    'online doctor booking',
    'doctor consultation bangladesh'
  ],
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Doctor Finder Bangladesh - Find & Book Doctor Appointments Online',
    description: 'Find the best doctors in Bangladesh. Search by specialty, location, or hospital. Read verified reviews and book appointments online.',
    type: 'website',
    url: '/',
    siteName: 'Doctor Finder Bangladesh',
    images: [{
      url: '/og-image.jpg',
      width: 1200,
      height: 630,
      alt: 'Doctor Finder Bangladesh'
    }]
  }
};

export default async function HomePage() {
  // Fetch data from MongoDB on the server
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME);

  // Fetch doctors (first 8 for homepage)
  const doctors = await db.collection('doctor_info')
    .find({})
    .limit(8)
    .toArray();

  // Fetch specialties, locations, hospitals
  const specialties = await db.collection('doctor_info').distinct('Speciality');
  const locations = await db.collection('doctor_info').distinct('Location');
  const hospitals = await db.collection('doctor_info').distinct('Hospital Name');

  // Fetch popular specialties by location (example: top 10 for Dhaka)
  const pairsAgg = await db.collection('doctor_info').aggregate([
    { $group: { _id: { location: '$Location', speciality: '$Speciality' }, count: { $sum: 1 } } },
    { $sort: { 'count': -1 } }
  ]).toArray();
  const popularSpecialties = pairsAgg
    .filter(pair => pair._id.location === 'Dhaka')
    .slice(0, 10)
    .map(pair => ({
      name: pair._id.speciality,
      location: pair._id.location,
      count: pair.count
    }));

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <HomePageContent
          doctors={doctors}
          specialties={specialties}
          locations={locations}
          hospitals={hospitals}
          popularSpecialties={popularSpecialties}
        />
      </Suspense>
    </ErrorBoundary>
  );
}