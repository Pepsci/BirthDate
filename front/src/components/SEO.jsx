import { Helmet } from 'react-helmet-async'

const SEO = ({
  title = 'BirthReminder – Ne rate plus aucun anniversaire',
  description = 'BirthReminder t\'envoie des rappels d\'anniversaire au bon moment. Ajoute tes proches et reçois des notifications par email.',
  image = 'https://birthreminder.com/og-image.png',
  url = 'https://birthreminder.com',
}) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />

    {/* Open Graph */}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={image} />
    <meta property="og:url" content={url} />
    <meta property="og:type" content="website" />

    {/* Twitter Card */}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={image} />

    <link rel="canonical" href={url} />
    
      {/* Schema.org JSON-LD */}
    <script type="application/ld+json">
      {JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "BirthReminder",
        "url": "https://birthreminder.com",
        "description": "BirthReminder t'envoie des rappels d'anniversaire au bon moment. Ajoute tes proches, gère tes listes de cadeaux et discute en direct avec tes amis.",
        "applicationCategory": "LifestyleApplication",
        "operatingSystem": "Web",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "EUR"
        },
        "inLanguage": "fr"
      })}
    </script>
  </Helmet>
)

export default SEO