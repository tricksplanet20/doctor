import type { Metadata } from 'next';
import DoctorPageClient from './DoctorPageClient';
import { clientPromise } from '@/lib/mongodb';
import Breadcrumbs from '@/components/Breadcrumbs';
import { createSafeUrl } from '@/lib/urlHelpers';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function generateBreadcrumbs(doctorData: any): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];

  if (doctorData.Location) {
    breadcrumbs.push({
      label: doctorData.Location,
      href: `/hospitals/${encodeURIComponent(doctorData.Location)}`
    });
  }

  if (doctorData.Location && doctorData["Hospital Name"]) {
    const hospitalSlug = createSafeUrl(doctorData["Hospital Name"]);
    breadcrumbs.push({
      label: doctorData["Hospital Name"],
      href: `/hospitals/${encodeURIComponent(doctorData.Location)}/${hospitalSlug}`
    });
  }

  if (doctorData.Location && doctorData.Speciality) {
    const specialitySlug = doctorData.SP_Slug || createSafeUrl(doctorData.Speciality);
    breadcrumbs.push({
      label: doctorData.Speciality,
      href: `/specialists/${encodeURIComponent(doctorData.Location)}/${specialitySlug}`
    });
  }

  if (doctorData["Doctor Name"]) {
    breadcrumbs.push({ label: doctorData["Doctor Name"] }); // Last item doesn't need href
  }

  return breadcrumbs;
}

// @ts-ignore -- Next.js type issue
export async function generateMetadata({ params }: { params: { slug: string }}): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug);
  
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const doctor = await db.collection('doctor_info').findOne({ Slug: slug });

    if (!doctor) {
      return {
        title: 'Doctor Not Found - TopDoctorList',
        description: 'The requested doctor profile could not be found.',
      };
    }

    const ogImageUrl = new URL('/api/og', process.env.NEXT_PUBLIC_BASE_URL);
    ogImageUrl.searchParams.set('name', doctor['Doctor Name']);
    ogImageUrl.searchParams.set('specialty', doctor['Speciality']);
    ogImageUrl.searchParams.set('hospital', doctor['Hospital Name']);

    const title = `${doctor['Doctor Name']} - ${doctor['Speciality']} | TopDoctorList`;
    const description = `Book an appointment with ${doctor['Doctor Name']}, a ${doctor['Speciality']} at ${doctor['Hospital Name']}. View qualifications, experience, location, and contact details.`;

    return {
      title,
      description,
      keywords: [
        doctor['Doctor Name'],
        doctor['Speciality'],
        'doctor appointment',
        'medical specialist',
        doctor['Location'],
        'healthcare',
        'bangladesh doctors'
      ],
      alternates: {
        canonical: `/${doctor['Slug']}`,
      },
      openGraph: {
        title,
        description,
        url: `https://topdoctorlist.com/${doctor['Slug']}`,
        siteName: 'TopDoctorList',
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: `Book an appointment with ${doctor['Doctor Name']}`
          }
        ],
        type: 'profile',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl.toString()],
        creator: '@topdoctorlist',
        site: '@topdoctorlist'
      }
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Doctor Profile - TopDoctorList',
      description: 'View doctor profile and book appointments.',
    };
  }
}

export async function generateStaticParams() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME);
  const doctors = await db.collection('doctor_info')
    .find(
      { Slug: { $exists: true, $ne: null } },
      { projection: { Slug: 1 } }
    )
    .toArray();
  
  return doctors
    .filter(doc => doc && doc.Slug)
    .map(doc => ({ slug: doc.Slug }));
}

export const revalidate = 60;

// @ts-ignore -- Next.js type issue
export default async function DoctorPage({ params }: { params: { slug: string }}) {
  const slug = decodeURIComponent(params.slug);
  
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const doctor = await db.collection('doctor_info').findOne(
      { Slug: slug },
      {
        projection: {
          "Doctor Name": 1,
          "Photo URL": 1,
          Degree: 1,
          Speciality: 1,
          SP_Slug: 1,
          Designation: 1,
          Workplace: 1,
          About: 1,
          "Hospital Name": 1,
          Address: 1,
          Location: 1,
          "Visiting Hours": 1,
          "Appointment Number": 1,
          Slug: 1
        }
      }
    );

    if (!doctor) {
      return (
        <div className="error-container">
          <h1>Doctor Not Found</h1>
          <p>The requested doctor profile could not be found.</p>
        </div>
      );
    }

    // Map MongoDB result to Doctor interface explicitly with fallbacks
    const doctorData = {
      "Doctor Name": doctor["Doctor Name"] ?? "",
      "Photo URL": doctor["Photo URL"] ?? "",
      Degree: doctor.Degree ?? "",
      Speciality: doctor.Speciality ?? "",
      SP_Slug: doctor.SP_Slug ?? "",
      Designation: doctor.Designation ?? "",
      Workplace: doctor.Workplace ?? "",
      About: doctor.About ?? "",
      "Hospital Name": doctor["Hospital Name"] ?? "",
      Address: doctor.Address ?? "",
      Location: doctor.Location ?? "",
      "Visiting Hours": doctor["Visiting Hours"] ?? "",
      "Appointment Number": doctor["Appointment Number"] ?? "",
      Slug: doctor["Slug"] ?? ""
    };

    return (
      <>
        <Breadcrumbs items={generateBreadcrumbs(doctorData)} />
        <DoctorPageClient doctor={doctorData} />
      </>
    );
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return (
      <div className="error-container">
        <h1>Error</h1>
        <p>Failed to load doctor profile. Please try again later.</p>
      </div>
    );
  }
}