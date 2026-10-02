-- Public contact details verified on the companies' own websites.
update public.entreprises
set site_web = 'https://orchidisland.immo/',
    email = 'contact@orchidisland.immo',
    telephone = '+212 618 688 888',
    adresse = 'Centre d’affaires Oualid, Jbel Guéliz, 3e étage, bureau 10, Marrakech 40010'
where lower(nom) = lower('Orchid island real estate sarl');

update public.entreprises
set site_web = 'https://www.top-agro.com/',
    email = 'contact@marrakechtopagro.com',
    telephone = '+212 524 335 201',
    adresse = 'ZI Sidi Ghanem, Route de Safi, Marrakech'
where lower(nom) = lower('MARRAKECH TOP AGRO EXPORT');

update public.entreprises
set site_web = 'https://www.morthai-marrakech.com/',
    email = 'contact@morthai-marrakech.com',
    telephone = '+212 524 207 055',
    adresse = 'N° 52, 5e étage, Immeuble Le Noyer B, Rue Ibn Sina Atlassi, Guéliz, Marrakech'
where lower(nom) = lower('Mor Thai Spa Marrakech');
