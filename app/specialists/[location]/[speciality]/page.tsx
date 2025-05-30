import { notFound } from 'next/navigation';
import Link from 'next/link';
import { clientPromise } from '@/lib/mongodb';
import styles from './SpecialityPage.module.css';
import { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { createSafeUrl } from '@/lib/urlHelpers';

interface PageProps {
  params: {
    location: string;
    speciality: string;
  };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const location = decodeURIComponent(params.location);
  const speciality = decodeURIComponent(params.speciality).replace(/-/g, ' ');
  return {
    title: `Best ${speciality} Doctors in ${location} - Find & Book Appointments`,
    description: `Discover the top-rated ${speciality} doctors in ${location}. Check qualifications, chamber address, visiting hours, and book appointments directly with trusted specialists.`,
    alternates: {
      canonical: `/specialists/${encodeURIComponent(location)}/${encodeURIComponent(params.speciality)}`,
    },
    openGraph: {
      title: `Top ${speciality} Specialists in ${location}`,
      description: `Find and book appointments with the best ${speciality} doctors in ${location}. View detailed profiles, qualifications, chamber timings, and contact information.`,
    },
  };
}

async function getDoctors(location: string, specialitySlug: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
        
    const doctors = await db.collection('doctor_info')
      .find({
        Location: { $regex: new RegExp(`^${location}$`, 'i') },
        SP_Slug: specialitySlug
      })
      .sort({ 'Rating': -1, 'Experience Years': -1 })
      .project({
        "Doctor Name": 1,
        Speciality: 1,
        SP_Slug: 1,
        Designation: 1,
        Degree: 1,
        "Hospital Name": 1,
        Address: 1,
        Location: 1,
        "Visiting Hours": 1,
        "Appointment Number": 1,
        Slug: 1
      })
      .toArray();

    // Get related specialities with their slugs
    const relatedSpecialities = await db.collection('doctor_info')
      .aggregate([
        { 
          $match: {
            Location: { $regex: new RegExp(`^${location}$`, 'i') },
            SP_Slug: { $exists: true, $ne: specialitySlug }
          }
        },
        {
          $group: {
            _id: '$Speciality',
            slug: { $first: '$SP_Slug' },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: 0 }
          }
        },
        {
          $project: {
            _id: 0,
            name: '$_id',
            slug: 1,
            count: 1
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5  // Limit to top 5 related specialties
        }
      ]).toArray();
    
    return { doctors, relatedSpecialities };
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return { doctors: [], relatedSpecialities: [] };
  }
}

export async function generateStaticParams(): Promise<{ location: string; speciality: string }[]> {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME);
  
  // Get all valid location-specialty pairs with their slugs
  const pairs = await db.collection('doctor_info').aggregate([
    { 
      $match: { 
        Location: { $exists: true, $ne: null },
        Speciality: { $exists: true, $ne: null },
        SP_Slug: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          location: '$Location',
          speciality: '$SP_Slug'  // Use SP_Slug for the URL
        },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 0 } }
    }
  ]).toArray();

  // Transform data ensuring all values are strings for Next.js
  return pairs.map(pair => ({
    location: String(pair._id.location),
    speciality: String(pair._id.speciality)
  }));
}

export const revalidate = 60;

export default async function SpecialityPage({ params }: PageProps) {
  try {
    const location = decodeURIComponent(params.location);
    const specialitySlug = decodeURIComponent(params.speciality);
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    // Get the actual specialty name from the database using SP_Slug
    const specialtyData = await db.collection('doctor_info')
      .findOne(
        { SP_Slug: specialitySlug },
        { projection: { Speciality: 1 } }
      );
    
    if (!specialtyData) {
      return notFound();
    }
    
    const formattedSpeciality = specialtyData.Speciality;

    // Use SP_Slug directly for finding doctors
    const { doctors, relatedSpecialities } = await getDoctors(location, specialitySlug);

    if (!doctors.length) {
      return (
        <div className={styles.errorContainer}>
          <h1>No {formattedSpeciality} doctors found in {location}</h1>
          <p>Try searching for a different specialty or location.</p>
          <Link href="/" className={styles.backButton}>Return to Home</Link>
        </div>
      );
    }

    const topRelatedSpecialities = relatedSpecialities;

    return (
      <div className={styles.container}>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: location, href: `/hospitals/${encodeURIComponent(location)}` },
            { label: formattedSpeciality }
          ]}
        />
        
        <div className={styles.pageHeader}>
          <h1 className={styles.sectionTitle}>
            Best {formattedSpeciality} Doctors in {location}
          </h1>
          <p className={styles.pageDescription}>
            Need expert care from a qualified {formattedSpeciality.toLowerCase()} doctor in {location}? 
            Here's a carefully curated list of doctors who specialize in {formattedSpeciality.toLowerCase()}, 
            serving patients at reputed hospitals and clinics throughout {location}.
          </p>
        </div>

        <section className={styles.mainSection}>
          <h2 className={styles.sectionSubtitle}>
            Find the Best {formattedSpeciality} Doctors in {location}
          </h2>
          <p className={styles.sectionText}>
            All profiles include chamber times, contact details, and hospital affiliations 
            to help you make the right choice for your healthcare. Our listed doctors are 
            verified for their qualifications and experience in {formattedSpeciality.toLowerCase()} care.
          </p>

          <div className={styles.doctorCardGrid}>
            {doctors.map((doctor: any) => (
              <Link href={`/${doctor.Slug}`} key={doctor.Slug} className={styles.doctorCard}>
                <div className={styles.doctorCardContent}>
                  <div className={styles.doctorCardHeader}>
                    <div className={styles.doctorName}>{doctor["Doctor Name"]}</div>
                    <div className={styles.doctorSpecialty}>
                      {doctor.Designation || formattedSpeciality}
                    </div>
                    <div className={styles.doctorDegree}>{doctor.Degree}</div>
                    <div className={styles.hospitalName}>{doctor["Hospital Name"]}</div>
                  </div>
                  <div className={styles.doctorContact}>
                    <div className={styles.doctorLocation}>📍 {doctor.Address || doctor.Location}</div>
                    {doctor["Visiting Hours"] && (
                      <div className={styles.visitingHours}>⏰ {doctor["Visiting Hours"]}</div>
                    )}
                    {doctor["Appointment Number"] && (
                      <div className={styles.appointmentNumber}>📞 {doctor["Appointment Number"]}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {topRelatedSpecialities.length > 0 && (
          <section className={styles.relatedSection}>
            <h2 className={styles.sectionSubtitle}>
              Related Specialities in {location}
            </h2>
            <div className={styles.relatedLinks}>
              {topRelatedSpecialities.map((relatedSpeciality) => (
                <Link
                  key={relatedSpeciality.name}
                  href={`/specialists/${encodeURIComponent(location)}/${relatedSpeciality.slug}`}
                  className={styles.relatedLink}
                >
                  Best {relatedSpeciality.name} Doctors in {location} ({relatedSpeciality.count})
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error loading specialty page:', error);
    return (
      <div className={styles.errorContainer}>
        <h1>Error loading specialty page</h1>
        <p>There was a problem loading this page. Please try again later.</p>
        <Link href="/" className={styles.backButton}>Return to Home</Link>
      </div>
    );
  }
}
