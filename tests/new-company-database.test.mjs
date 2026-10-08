import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('publication is insert-only, complete, deduplicated, private and idempotent',{skip:!process.env.PGLITE_MODULE},async()=>{
  const {PGlite}=await import(process.env.PGLITE_MODULE);
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create table public.entreprises(id serial primary key,nom text,domaine text,adresse text,telephone text,site_web text,email text,is_active boolean default true);insert into entreprises(nom,site_web) values('Entreprise historique','https://historique.ma/');`);
  await db.exec(await readFile(new URL('../backend/supabase/migrations/202610080003_new_company_discovery.sql',import.meta.url),'utf8'));
  const original=(await db.query('select to_jsonb(e) as data from entreprises e where id=1')).rows[0].data;
  const queue=async(id,website,name='Atlas Logiciels')=>db.query('select enqueue_company_candidates($1::jsonb)',[JSON.stringify([{source_id:id,nom:name,site_web:website}])]);
  const record={nom:'Atlas Logiciels',domaine:'IT & Digital',adresse:'12 avenue Mohamed V, Marrakech 40000',telephone:'+212524123456',site_web:'https://atlas.ma/',email:'contact@atlas.ma'};
  const save=async(id,data,missing=[])=>db.query('select save_new_company_candidate($1,$2::jsonb,$3::text[],$4::jsonb,$5) as status',[id,JSON.stringify(data),missing,JSON.stringify([data.site_web]),'missing_information']);
  await queue('node/1','https://atlas.ma/');
  for(const key of Object.keys(record)) await assert.rejects(save('node/1',{...record,[key]:''}));
  await assert.rejects(save('node/1',{...record,adresse:'12 rue Casablanca'}));
  await assert.rejects(save('node/1',{...record,telephone:'0000000000'}));
  assert.equal((await save('node/1',{...record,email:''},['email'])).rows[0].status,'pending');
  assert.equal((await db.query('select count(*)::int n from entreprises')).rows[0].n,1);
  assert.equal((await save('node/1',record)).rows[0].status,'published');
  assert.equal((await save('node/1',record)).rows[0].status,'published');
  await queue('node/2','https://www.atlas.ma/contact');
  assert.equal((await db.query("select status from private.company_discovery_candidates where source_id='node/2'")).rows[0].status,'existing');
  await queue('node/3','https://alternate.ma/');
  assert.equal((await save('node/3',{...record,site_web:'https://alternate.ma/'})).rows[0].status,'existing');
  assert.equal((await db.query('select count(*)::int n from entreprises')).rows[0].n,2);
  assert.deepEqual((await db.query('select to_jsonb(e) as data from entreprises e where id=1')).rows[0].data,original);
  for(const role of ['anon','authenticated']){
    assert.equal((await db.query(`select has_function_privilege('${role}','public.save_new_company_candidate(text,jsonb,text[],jsonb,text)','execute') as allowed`)).rows[0].allowed,false);
    assert.equal((await db.query(`select has_table_privilege('${role}','private.company_discovery_candidates','select') as allowed`)).rows[0].allowed,false);
  }
  const run=(await db.query('select begin_new_company_sync() id')).rows[0].id;
  assert.ok(run);assert.equal((await db.query('select begin_new_company_sync() id')).rows[0].id,null);
  await db.query("select finish_new_company_sync($1,'succeeded','{}')",[run]);
  assert.equal((await db.query('select begin_new_company_sync() id')).rows[0].id,null);
  await db.close();
});
