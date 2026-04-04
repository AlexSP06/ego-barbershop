document.addEventListener('DOMContentLoaded', () => {

  // Scroll la top
  window.scrollTo(0, 0);

  // Navbar
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // Hamburger
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
    });
  });

  // Lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const galleryItems = document.querySelectorAll('.gallery-item');
  let currentIndex = 0;

  galleryItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      currentIndex = index;
      lightboxImg.src = item.querySelector('img').src;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  function showImage(index) {
    currentIndex = (index + galleryItems.length) % galleryItems.length;
    lightboxImg.src = galleryItems[currentIndex].querySelector('img').src;
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  lightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex - 1);
  });
  lightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex + 1);
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
  });

  // Scroll Reveal
  const revealElements = document.querySelectorAll(
    '.service-card, .team-card, .gallery-item, .contact-item, .section-title, .section-label'
  );

  function checkReveal() {
    revealElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 50) {
        setTimeout(() => el.classList.add('revealed'), index * 80);
      }
    });
  }

  window.addEventListener('scroll', checkReveal);
  checkReveal();

  // ===== FORMULAR REZERVARE =====
  let barberSelectat = null;
  let oraSelectata = null;

  // Flatpickr calendar
  flatpickr('#data', {
    locale: 'ro',
    minDate: 'today',
    disable: [date => date.getDay() === 0],
    dateFormat: 'Y-m-d',
    onChange: () => incarcaSloturi()
  });

  // Selectare barber
  document.querySelectorAll('.barber-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.barber-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      barberSelectat = option.dataset.barber;
      incarcaSloturi();
    });
  });

  // Încarcă sloturi
  async function incarcaSloturi() {
    const data = document.getElementById('data').value;
    if (!barberSelectat || !data) return;

    const grid = document.getElementById('sloturiGrid');
    grid.innerHTML = '<p class="sloturi-hint">Se încarcă...</p>';

    try {
      const response = await fetch(`http://localhost:3000/sloturi?data=${data}&barber=${barberSelectat}`);
      const result = await response.json();

      grid.innerHTML = '';
      oraSelectata = null;

      result.disponibile.forEach(slot => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.textContent = slot;
        div.addEventListener('click', () => {
          document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
          div.classList.add('selected');
          oraSelectata = slot;
        });
        grid.appendChild(div);
      });

      result.rezervate.forEach(slot => {
        const div = document.createElement('div');
        div.className = 'slot rezervat';
        div.textContent = slot;
        grid.appendChild(div);
      });

      if (result.disponibile.length === 0) {
        grid.innerHTML = '<p class="sloturi-hint">Nu mai sunt sloturi disponibile.</p>';
      }
    } catch (err) {
      grid.innerHTML = '<p class="sloturi-hint">Eroare la încărcarea sloturilor.</p>';
    }
  }

  // Submit
  document.getElementById('submitBtn').addEventListener('click', async () => {
    const nume = document.getElementById('nume').value;
    const telefon = document.getElementById('telefon').value;
    const email = document.getElementById('email').value;
    const serviciu = document.getElementById('serviciu').value;
    const data = document.getElementById('data').value;
    const mesaj = document.getElementById('mesaj').value;

    if (!barberSelectat) { alert('Alege un barber!'); return; }
    if (!serviciu) { alert('Alege un serviciu!'); return; }
    if (!data) { alert('Alege o dată!'); return; }
    if (!oraSelectata) { alert('Alege o oră!'); return; }
    if (!nume) { alert('Introdu numele tău!'); return; }
    if (!telefon) { alert('Introdu numărul de telefon!'); return; }

    try {
      const response = await fetch('http://localhost:3000/rezervare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nume, telefon, email,
          barber: barberSelectat,
          serviciu, data,
          ora: oraSelectata,
          mesaj
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('Rezervarea ta a fost înregistrată! Vei primi un email de confirmare.');
        document.querySelectorAll('.barber-option').forEach(o => o.classList.remove('selected'));
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        barberSelectat = null;
        oraSelectata = null;
        document.getElementById('nume').value = '';
        document.getElementById('telefon').value = '';
        document.getElementById('email').value = '';
        document.getElementById('serviciu').selectedIndex = 0;
        document.getElementById('data').value = '';
        document.getElementById('mesaj').value = '';
        document.getElementById('sloturiGrid').innerHTML = '<p class="sloturi-hint">Selectează mai întâi barberul și data</p>';
      } else {
        alert('Eroare: ' + result.error);
      }
    } catch (err) {
      alert('Eroare la conectarea cu serverul!');
      console.error(err);
    }
  });

}); // închide DOMContentLoaded