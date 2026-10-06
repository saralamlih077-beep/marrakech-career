import { useEffect, useState } from 'react';
import indexInfo from '../companySearchIndexInfo.json';
import type { CompanyActivityIndex } from '../companySearch';

let request: Promise<CompanyActivityIndex> | undefined;
function loadIndex() {
  request ??= fetch(indexInfo.path).then(async response => {
    if (!response.ok) throw new Error('Activity index unavailable');
    const result = await response.json();
    if (!result.pages || typeof result.pages !== 'object' || Array.isArray(result.pages)) throw new Error('Invalid activity index');
    return result.pages as CompanyActivityIndex;
  }).catch(error => { request = undefined; throw error; });
  return request;
}

export function useCompanyActivityIndex() {
  const [pages, setPages] = useState<CompanyActivityIndex>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    loadIndex().then(pages => { if (active) setPages(pages); })
      .catch(() => { if (active) setUnavailable(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { pages, loading, unavailable };
}
