'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import styles from '../app/HomePage.module.css';
import Loading from './Loading';
import HeroSection from './HeroSection';
import dynamic from 'next/dynamic';
import SchemaOrg from './SchemaOrg';
import Head from 'next/head';
import Link from 'next/link';
import { createSafeUrl } from '@/lib/urlHelpers';

const Doctor = dynamic(() => import('./Doctor'), {
  loading: () => <Loading />,
  ssr: true
});

interface Doctor {
  "Doctor Name": string;
  "Photo URL": string;
  Degree: string;
  Speciality: string;
  Designation: string;
  Workplace: string;
  About: string;
  "Hospital Name": string;
  Address: string;
  Location: string;
  "Visiting Hours": string;
  "Appointment Number": string;
  Slug: string;
}

interface SearchFilters {
  name: string;
  speciality: string;
  location: string;
  hospital: string;
  sortBy?: string;
}

interface SpecialtyPair {
  location: string;
  speciality: string;
  slugifiedSpeciality: string;
  count: number;
}

interface HomePageContentProps {
  doctors: any[];
  specialties: string[];
  locations: string[];
  hospitals: string[];
  popularSpecialties: { name: string; location: string; count: number; slug: string }[];
}

export default function HomePageContent({
  doctors: initialDoctors,
  specialties,
  locations,
  hospitals,
  popularSpecialties: initialPopularSpecialties,
}: HomePageContentProps) {
  // State for dynamic updates
  const [doctors, setDoctors] = React.useState(initialDoctors);
  const [popularSpecialties, setPopularSpecialties] = React.useState(initialPopularSpecialties);
  const [loading, setLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [filters, setFilters] = React.useState<SearchFilters>({
    name: '',
    speciality: '',
    location: '',
    hospital: '',
    sortBy: undefined,
  });
  const [selectedLocation, setSelectedLocation] = React.useState(locations[0] || 'Dhaka');

  // Fetch doctors from API
  const fetchDoctors = async (newFilters: SearchFilters) => {
    setLoading(true);
    setFilters(newFilters);
    const params = new URLSearchParams({
      ...(newFilters.name && { name: newFilters.name }),
      ...(newFilters.speciality && { speciality: newFilters.speciality }),
      ...(newFilters.location && { location: newFilters.location }),
      ...(newFilters.hospital && { hospital: newFilters.hospital }),
      sortBy: newFilters.sortBy || 'name',
      page: currentPage.toString(),
      pageSize: '8',
    });
    const res = await fetch(`/api/doctors?${params}`);
    const data = await res.json();
    setDoctors(data.doctors || []);
    setLoading(false);
  };

  // Fetch popular specialties for a location
  const fetchPopularSpecialties = async (location: string) => {
    setLoading(true);
    const res = await fetch(`/api/doctors?uniqueLocationSpecialityPairs=true`);
    const data = await res.json();
    const pairs = (data.pairs || []).filter((pair: any) => pair.location === location)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10)
      .map((pair: any) => ({
        name: pair.name,
        location: pair.location,
        count: pair.count,
        slug: pair.slug
      }));
    setPopularSpecialties(pairs);
    setLoading(false);
  };

  // Update specialties when location changes
  React.useEffect(() => {
    fetchPopularSpecialties(selectedLocation);
  }, [selectedLocation]);

  // Handler for location change (for specialties)
  const handleLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLocation(event.target.value);
  };

  // Pagination and filter state (client-side only)
  // const [currentPage, setCurrentPage] = React.useState(1);
  // const [filters, setFilters] = React.useState<SearchFilters>({
  //   name: '',
  //   speciality: '',
  //   location: '',
  //   hospital: '',
  //   sortBy: undefined,
  // });
  // const [selectedLocation, setSelectedLocation] = React.useState(locations[0] || 'Dhaka');

  // Handler for page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Optionally, trigger a fetch for new page data if needed
  };

  // Pagination rendering logic (uses currentPage and a fixed totalPages for now)
  const totalPages = 1; // Set to 1 for static SSR, or calculate if you add pagination
  const renderPaginationButtons = () => {
    const siblingCount = 1;
    const DOTS = '...';
    const totalPageNumbers = siblingCount * 2 + 3;
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;
    if (totalPages <= totalPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, DOTS, totalPages];
    }
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1
      );
      return [1, DOTS, ...rightRange];
    }
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i
      );
      return [1, DOTS, ...middleRange, DOTS, totalPages];
    }
  };

  // Use the full doctor list for navigation filtering, not just paginated/filtered doctors
  // This ensures only valid, non-empty links are shown for specialties, hospitals, and locations
  const allDoctors = initialDoctors; // Should be the full list, not paginated

  // For specialties, show only those with at least one doctor in the selected location
  const specialtiesWithDoctors = specialties
    .map(specialty => String(specialty))
    .filter(specialty =>
      allDoctors.some(doc => doc.Speciality === specialty && doc.Location === selectedLocation)
    );
  // For hospitals, show only those with at least one doctor in the selected location
  const hospitalsWithDoctors = hospitals.filter(hospital =>
    allDoctors.some(doc => doc["Hospital Name"] === hospital && doc.Location === selectedLocation)
  );
  // For locations, show only those with at least one doctor
  const locationsWithDoctors = locations.filter(location =>
    allDoctors.some(doc => doc.Location === location)
  );

  return (
    <>
      <Head>
        <title>Find Top Doctors in Bangladesh | Book Appointments Online</title>
        <meta name="description" content="Find and book appointments with the best doctors in Bangladesh. Search by location, hospital, and more. Trusted doctor reviews and easy online booking." />
      </Head>
      <SchemaOrg doctors={doctors} />
      <main>
        <h1 className={styles.mainHeading}>Find and Book Doctor Appointments in Bangladesh</h1>
        <HeroSection
          onSearch={fetchDoctors}
          specialties={specialties}
          locations={locations}
          hospitals={hospitals}
          loading={loading}
        />
        {/* Quick Specialty Navigation Section */}
        <section className={styles.quickSpecialtyNavSection}>
          <div className={styles.quickSpecialtyNavHeader}>
            <h2 className={styles.quickSpecialtyNavTitle}>
              Popular Medical Specialties
            </h2>
            <div className={styles.locationSelector}>
              <select 
                value={selectedLocation}
                onChange={handleLocationChange}
                className={styles.locationSelect}
              >
                {locations.map(location => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.quickSpecialtyNavGrid}>
            {popularSpecialties
              .map(({ name, location, count, slug }) => (
                <Link
                  key={name}
                  href={`/specialists/${encodeURIComponent(location)}/${slug}`}
                  className={styles.quickSpecialtyNavLink}
                >
                  <span>{name}</span>
                  <span className={styles.specialtyCount}>{count}</span>
                </Link>
              ))}
          </div>
        </section>
        {/* Popular Hospitals Section (show hospitals with at least one doctor, any location) */}
        <section className={styles.quickSpecialtyNavSection}>
          <h2 className={styles.quickSpecialtyNavTitle}>Popular Hospitals</h2>
          <div className={styles.quickSpecialtyNavGrid}>
            {hospitals
              .filter(hospital => allDoctors.some(doc => doc["Hospital Name"] === hospital))
              .slice(0, 12)
              .map(hospital => {
                // Find a doctor for this hospital to get a valid location
                const doctor = allDoctors.find(doc => doc["Hospital Name"] === hospital);
                if (!doctor) return null;
                const location = doctor.Location;
                const hospitalSlug = hospital.replace(/\s+/g, '-').toLowerCase();
                return (
                  <Link
                    key={hospital}
                    href={`/hospitals/${encodeURIComponent(location)}/${hospital.replace(/\s+/g, '-').toLowerCase()}`}
                    className={styles.quickSpecialtyNavLink}
                  >
                    {hospital}
                  </Link>
                );
              })}
          </div>
        </section>
        {/* Popular Locations Section */}
        <section className={styles.quickSpecialtyNavSection}>
          <h2 className={styles.quickSpecialtyNavTitle}>Popular Locations</h2>
          <div className={styles.quickSpecialtyNavGrid}>
            {locationsWithDoctors.slice(0, 12).map(location => (
              <Link
                key={location}
                href={`/hospitals/${encodeURIComponent(location)}`}
                className={styles.quickSpecialtyNavLink}
              >
                {location}
              </Link>
            ))}
          </div>
        </section>
        <section aria-label="Featured Doctors" className={styles.doctorsSection}>
          <h2 className={styles.sectionTitle}>Top Doctors</h2>
          <div className={styles.doctorCardGrid}>
            {loading ? (
              <Loading />
            ) : doctors.length === 0 ? (
              <div className={styles.noResults} role="alert">
                <h2>No doctors found</h2>
                <p>Try adjusting your search filters or try a different location.</p>
              </div>
            ) : (
              doctors.map((doctor) => (
                <Suspense key={doctor["Doctor Name"]} fallback={<Loading />}>
                  <article className={styles.doctorCard}>
                    <Doctor doctor={doctor} />
                  </article>
                </Suspense>
              ))
            )}
          </div>
          {/* Pagination navigation (static for SSR) */}
          {totalPages > 1 && (
            <nav aria-label="Pagination" className={styles.pagination}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={styles.pageButton}
                aria-label="Go to previous page"
              >
                Previous
              </button>
              {renderPaginationButtons()?.map((pageNum, i) => (
                <button
                  key={i}
                  onClick={() => pageNum !== '...' && handlePageChange(Number(pageNum))}
                  className={`${styles.pageButton} ${
                    pageNum === '...' ? styles.dots : ''
                  } ${currentPage === pageNum ? styles.activePage : ''}`}
                  disabled={pageNum === '...'}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                  aria-label={pageNum === '...' ? 'More pages' : `Go to page ${pageNum}`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={styles.pageButton}
                aria-label="Go to next page"
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </main>
    </>
  );
}