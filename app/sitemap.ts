import { MetadataRoute } from 'next';
import { clientPromise } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { createSafeUrl } from '@/lib/urlHelpers';

// Function to escape XML special characters
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
}

function createValidSlug(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://topdoctorlist.com';

  // Get all doctors from the database
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME);

  // Get all doctor profile URLs
  const doctors = await db.collection('doctor_info')
    .find({
      Slug: { $exists: true, $ne: null }
    })
    .project({ Slug: 1, "Last Modified": 1 })
    .toArray();

  const doctorUrls = doctors
    .filter(doctor => doctor.Slug && typeof doctor.Slug === 'string' && doctor.Slug.length > 0)
    .map((doctor) => {
      const safeSlug = escapeXml(doctor.Slug);
      return {
        url: `${baseUrl}/${safeSlug}`,
        lastModified: doctor["Last Modified"] || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8
      };
    });

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3
    }
  ];

  // Get all specialty pages using location-specialty pairs and SP_Slug
  const specialtyPages = [];
  const specialtyPairs = await db.collection('doctor_info').aggregate([
    {
      $match: {
        Location: { $exists: true, $ne: null },
        Speciality: { $exists: true, $ne: null },
        SP_Slug: { $exists: true, $ne: null, $ne: '' }
      }
    },
    {
      $group: {
        _id: {
          location: "$Location",
          speciality: "$Speciality"
        },
        sp_slug: { $first: "$SP_Slug" },
        count: { $sum: 1 },
        lastModified: { $max: "$Last Modified" }
      }
    },
    {
      $match: {
        count: { $gt: 0 },
        "sp_slug": { $ne: null, $ne: '' }
      }
    },
    {
      $project: {
        _id: 1,
        sp_slug: 1,
        count: 1,
        lastModified: 1
      }
    }
  ]).toArray();

  for (const pair of specialtyPairs) {
    if (pair._id?.location && pair._id?.speciality && pair.sp_slug) {
      const location = escapeXml(pair._id.location);
      const specialtySlug = escapeXml(pair.sp_slug);
      
      if (location && specialtySlug) {
        specialtyPages.push({
          url: `${baseUrl}/specialists/${encodeURIComponent(location)}/${specialtySlug}`,
          lastModified: pair.lastModified || new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7
        });
      }
    }
  }

  // Add location index pages for specialties
  const uniqueLocations = new Set(specialtyPairs.map(pair => pair._id?.location).filter(Boolean));
  for (const location of uniqueLocations) {
    specialtyPages.push({
      url: escapeXml(`${baseUrl}/specialists/${encodeURIComponent(location)}`),
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7
    });
  }

  // Hospital pages
  const hospitalPages = [];
  const hospitalData = await db.collection('doctor_info').aggregate([
    {
      $match: {
        'Hospital Name': { $exists: true, $ne: null },
        'Location': { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          hospital: '$Hospital Name',
          location: '$Location'
        },
        lastModified: { $max: '$Last Modified' }
      }
    }
  ]).toArray();

  // Add hospital location pages
  const uniqueHospitalLocations = new Set(hospitalData
    .map(item => item._id?.location)
    .filter(Boolean)
  );

  for (const location of uniqueHospitalLocations) {
    hospitalPages.push({
      url: escapeXml(`${baseUrl}/hospitals/${encodeURIComponent(location)}`),
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7
    });
  }

  // Add individual hospital pages
  for (const data of hospitalData) {
    if (data._id?.hospital && data._id?.location) {
      const location = escapeXml(data._id.location);
      const hospitalSlug = createValidSlug(data._id.hospital);
      
      if (location && hospitalSlug) {
        const url = `${baseUrl}/hospitals/${encodeURIComponent(location)}/${hospitalSlug}`;
        
        if (url.length <= 2048) { // Stay within reasonable URL length limits
          hospitalPages.push({
            url,
            lastModified: data.lastModified || new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.7
          });
        }
      }
    }
  }

  const urls = [
    ...staticPages,
    ...doctorUrls,
    ...specialtyPages,
    ...hospitalPages
  ];

  return urls;
}
