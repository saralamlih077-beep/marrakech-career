import { jsPDF } from 'jspdf';
import type { GeneratedCv, CvSection } from '../app/tailoredCv';

export function tailoredCvPdf(cv: GeneratedCv) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const sunshine = cv.layout === 'sunshine';
  const golden = cv.layout === 'golden-columns';
  const accent = sunshine || golden ? '#252C32' : { navy: '#243747', forest: '#304A40', charcoal: '#383B40' }[cv.palette];
  const sidebar = cv.layout === 'sidebar' || sunshine;
  const photo = (x: number, y: number, size: number, round = false) => {
    if (!cv.identity.photoDataUrl) return;
    pdf.saveGraphicsState();
    if (round) { pdf.circle(x + size / 2, y + size / 2, size / 2, null); pdf.clip(); pdf.discardPath(); }
    pdf.addImage(cv.identity.photoDataUrl, cv.identity.photoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, size, size);
    pdf.restoreGraphicsState();
  };
  const createColumn = (x: number, width: number, inverse = false, initialY = 20) => {
    let page = 1;
    let y = initialY;
    const background = () => {
      if (sidebar) { pdf.setFillColor(accent); pdf.rect(0, 0, 64, 297, 'F'); }
      if (sunshine && pdf.getCurrentPageInfo().pageNumber === 1) { pdf.setFillColor('#E9B422'); pdf.triangle(0, 0, 64, 0, 0, 55, 'F'); }
    };
    const nextPage = () => {
      page++;
      if (page > pdf.getNumberOfPages()) { pdf.addPage(); background(); }
      else pdf.setPage(page);
      y = 20;
    };
    const text = (content: string, size = 10, bold = false, color = inverse ? '#FFFFFF' : '#475569', font = 'helvetica') => {
      if (!content.trim()) return;
      pdf.setPage(page);
      pdf.setFont(font, bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color);
      const lines = pdf.splitTextToSize(content, width) as string[];
      for (const line of lines) {
        if (y + size * 0.45 > 276) nextPage();
        pdf.text(line, x, y); y += size * 0.45 + 0.8;
      }
    };
    const heading = (title: string) => {
      if (y > 250) nextPage();
      if (golden || sunshine) { pdf.setFillColor('#E9B422'); pdf.circle(x + 1.2, y - 1.1, 1.2, 'F'); }
      text(`${golden || sunshine ? '   ' : ''}${title.toUpperCase()}`, 9, true, inverse ? '#FFFFFF' : accent);
      pdf.setDrawColor(inverse ? '#89949C' : '#DDE2E7'); pdf.setLineWidth(0.2); pdf.line(x, y, x + width, y); y += 5;
    };
    const sections = (items: CvSection[]) => items.forEach(section => {
      heading(section.title);
      section.items.forEach(item => {
        if (y > 256) nextPage();
        text(item.heading, 10, true, inverse ? '#FFFFFF' : '#1E293B');
        text(item.period, 8); text(item.subheading, 9);
        item.bullets.forEach(bullet => text(`- ${bullet}`, 9));
        y += 3;
      });
      y += 4;
    });
    return { text, heading, sections, space: (amount: number) => { y += amount; }, background, position: () => y };
  };
  const contacts = [cv.identity.email, cv.identity.phone, cv.identity.city, cv.identity.linkedin].filter(Boolean);
  if (golden) {
    const nameX = cv.identity.photoDataUrl ? 51 : 23;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20);
    const nameHeight = (pdf.splitTextToSize(cv.identity.fullName, 118 - nameX) as string[]).length * 10;
    pdf.setFontSize(10);
    const roleHeight = (pdf.splitTextToSize(cv.identity.targetRole, 118 - nameX) as string[]).length * 5;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    const contactHeight = contacts.reduce((height, contact) => height + (pdf.splitTextToSize(contact, 57) as string[]).length * 4.5, 0);
    const headerHeight = Math.max(38, nameHeight + roleHeight + 13, contactHeight + 15);
    pdf.setFillColor('#F0F0EE'); pdf.rect(17, 13, 176, headerHeight, 'F');
    photo(22, 19, 24);
    const title = createColumn(nameX, 118 - nameX, false, 24); title.text(cv.identity.fullName.toUpperCase(), 20, true, accent); title.space(2); title.text(cv.identity.targetRole, 10);
    const headerContacts = createColumn(130, 57, false, 22); contacts.forEach(contact => headerContacts.text(contact, 8));
    const bodyY = 13 + headerHeight + 12;
    const left = createColumn(19, 91, false, bodyY); const right = createColumn(124, 67, false, bodyY);
    pdf.setDrawColor('#E9B422'); pdf.line(116, bodyY - 3, 116, 277);
    left.heading('Profil'); left.text(cv.summary, 10); left.space(7);
    left.sections(cv.sections.filter(section => ['experience', 'education'].includes(section.kind)));
    right.sections(cv.sections.filter(section => !['experience', 'education'].includes(section.kind)));
  } else {
  const main = createColumn(sidebar ? 76 : 19, sidebar ? 116 : 172);
  main.background();
  if (!sunshine) {
    if (!sidebar && cv.identity.photoDataUrl) {
      photo(164, 16, 27, cv.layout === 'editorial');
      const title = createColumn(19, 133); title.text(cv.identity.fullName, 23, true, accent, cv.layout === 'editorial' ? 'times' : 'helvetica'); title.space(2); title.text(cv.identity.targetRole, 11, false, accent);
      main.space(Math.max(35, title.position() - 20 + 6));
    } else { main.text(cv.identity.fullName, 23, true, accent, cv.layout === 'editorial' ? 'times' : 'helvetica'); main.space(2); main.text(cv.identity.targetRole, 11, false, accent); main.space(6); }
  }
  if (sidebar) {
    const side = createColumn(9, 46, true);
    if (cv.identity.photoDataUrl) { photo(18, 17, 28, true); side.space(36); }
    if (sunshine) { if (!cv.identity.photoDataUrl) side.space(20); side.text(cv.identity.fullName, 17, true, '#F4C748'); side.text(cv.identity.targetRole, 10); side.space(9); }
    if (contacts.length) { side.heading('Contact'); contacts.forEach(contact => side.text(contact, 9)); side.space(9); }
    side.sections(cv.sections.filter(section => ['skills', 'languages'].includes(section.kind)));
  } else { main.text(contacts.join(' | '), 8); main.space(7); }
  main.heading('Profil'); main.text(cv.summary, 10); main.space(7);
  main.sections(sidebar ? cv.sections.filter(section => !['skills', 'languages'].includes(section.kind)) : cv.sections);
  }
  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) { pdf.setPage(page); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor('#94A3B8'); pdf.text(`${page} / ${count}`, 191, 289, { align: 'right' }); }
  return pdf;
}
