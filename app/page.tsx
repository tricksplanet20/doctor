import React, { Suspense } from 'react';
import Loading from '../components/Loading';
import ErrorBoundary from '../components/ErrorBoundary';
import dynamic from 'next/dynamic';
import { clientPromise } from '../lib/mongodb';
import type { Metadata } from 'next';

// Dynamically import the client components
const HomePageContent = dynamic(() => import('../components/HomePageContent'), {
  loading: () => <Loading />,
  ssr: true
});

export const metadata: Metadata = {
  title: 'Find Doctors by Name, Speciality, Location | Doctor Finder',
  description: 'Search for qualified doctors in Bangladesh by name, speciality, or location. View detailed profiles, credentials, and book appointments with healthcare professionals.',
  alternates: {
    canonical: '/',
  },
};

export const revalidate = 60; // Revalidate this page every 60 seconds

export default async function HomePage() {
  // Fetch data from MongoDB on the server
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME);

  // Fetch doctors (first 8 for homepage)
  const doctors = (await db.collection('doctor_info')
    .find({})
    .limit(8)
    .toArray()
  ).map(doc => ({
    ...doc,
    _id: doc._id?.toString?.() ?? undefined,
  }));

  // Fetch specialties, locations, hospitals
  const specialties = await db.collection('doctor_info').distinct('Speciality');
  const locations = await db.collection('doctor_info').distinct('Location');
  const hospitals = await db.collection('doctor_info').distinct('Hospital Name');

  // Fetch popular specialties by location with slugs
  const pairsAgg = await db.collection('doctor_info').aggregate([
    {
      $match: {
        Location: 'Dhaka',
        Speciality: { $ne: null },
        SP_Slug: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          speciality: '$Speciality',
          location: '$Location'
        },
        sp_slug: { $first: '$SP_Slug' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();

  const popularSpecialties = pairsAgg.map(pair => ({
    name: pair._id.speciality,
    location: pair._id.location,
    count: pair.count,
    slug: pair.sp_slug
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
