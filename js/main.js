/* ==========================================================================
   Almejoy C. Ancero, Portfolio Scripts
   1. Mobile menu
   2. Navbar border on scroll
   3. Highlight the current section's nav link
   4. Fade-in sections while scrolling
   5. Certificate carousel (phones)
   6. Popups: certificate PDF and project screenshot
   7. Footer year
   ========================================================================== */

const header = document.getElementById('site-header');
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav__link');


/* 1. Mobile menu */
function setMenu(open) {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

toggle.addEventListener('click', () => {
    setMenu(!menu.classList.contains('is-open'));
});

// Close the menu after choosing a link
navLinks.forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
});

// Close the menu with the Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
    }
});


/* 2. Navbar border on scroll */
function updateHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
}

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();


/* 3. Highlight the current section's nav link */
const sections = document.querySelectorAll('main section[id]');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
            const isCurrent = link.getAttribute('href') === '#' + entry.target.id;
            link.classList.toggle('is-active', isCurrent);
            if (isCurrent) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    });
}, {
    // A section counts as "current" when it crosses the middle of the screen
    rootMargin: '-45% 0px -50% 0px',
});

sections.forEach((section) => sectionObserver.observe(section));


/* 4. Fade-in sections while scrolling */
const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);   // animate only once
        }
    });
}, {
    threshold: 0.12,
});

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));


/* 5. Certificate carousel (phones)
   On phones, CSS turns the certificate list into a sideways-scrolling row that
   snaps to one card at a time, so swiping needs no JavaScript.
   This code only keeps the position dots in sync with the card on screen. */
const track = document.getElementById('certificate-track');
const dots = [...document.querySelectorAll('[data-carousel-dot]')];

if (track && dots.length) {
    const slides = [...track.children];

    // Where the row is scrolled to when a card is lined up at the left.
    // The last card cannot reach the left edge, so it stops at the end of the row.
    function slidePosition(slide) {
        const leftPadding = parseFloat(getComputedStyle(track).paddingLeft);
        const maxScroll = track.scrollWidth - track.clientWidth;
        return Math.min(slide.offsetLeft - leftPadding, maxScroll);
    }

    // The card whose position is closest to how far the row is scrolled
    function currentSlide() {
        let closest = 0;
        slides.forEach((slide, i) => {
            const distance = Math.abs(slidePosition(slide) - track.scrollLeft);
            if (distance < Math.abs(slidePosition(slides[closest]) - track.scrollLeft)) {
                closest = i;
            }
        });
        return closest;
    }

    // Highlight the dot for the card on screen
    function updateDots() {
        const current = currentSlide();
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === current));
    }

    // Swiping scrolls the row; update the dots at most once per screen refresh
    let dotsQueued = false;
    track.addEventListener('scroll', () => {
        if (dotsQueued) return;
        dotsQueued = true;
        requestAnimationFrame(() => {
            updateDots();
            dotsQueued = false;
        });
    }, { passive: true });

    updateDots();
}


/* 6. Popups: certificate PDF and project screenshot
   Both popups are <dialog> elements in index.html. showModal() opens one in
   the center of the screen and dims the page behind it. */
const pdfModal = document.getElementById('pdf-modal');
const imageModal = document.getElementById('image-modal');

function openModal(modal) {
    document.documentElement.classList.add('has-modal');   // page behind stops scrolling
    modal.showModal();
}

// Play the fade-out animation (style.css section 12), then close
function closeModal(modal) {
    if (!modal.open || modal.classList.contains('is-closing')) return;
    modal.classList.add('is-closing');
    const finish = () => {
        if (!modal.classList.contains('is-closing')) return;
        modal.classList.remove('is-closing');
        modal.close();
    };
    modal.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 300);   // safety net in case the animation does not run
}

// The three ways to close: X button, click outside the box, Escape key
[pdfModal, imageModal].forEach((modal) => {
    if (!modal) return;
    modal.querySelector('[data-modal-close]').addEventListener('click', () => closeModal(modal));

    // A click on the dimmed area lands on the <dialog> itself, not on the box inside it
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal);
    });

    // Escape makes the browser fire "cancel"; close with the fade-out instead
    modal.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeModal(modal);
    });

    modal.addEventListener('close', () => document.documentElement.classList.remove('has-modal'));
});

// Certificate PDF popup
if (pdfModal) {
    const pdfTitle = pdfModal.querySelector('.modal__title');
    const pdfFallback = pdfModal.querySelector('.modal__fallback');
    const pdfPreview = pdfModal.querySelector('.modal__preview');
    let pdfFrame = pdfModal.querySelector('.modal__pdf');

    // Most computers can show a PDF inside the page; many phones cannot.
    // Those browsers report navigator.pdfViewerEnabled === false.
    const canShowPdf = navigator.pdfViewerEnabled !== false;

    // On phones (same width as the phone layout in style.css), the certificate is drawn
    // as a picture instead: it fits the popup's width exactly and works on every phone.
    const isPhone = window.matchMedia('(max-width: 640px)');

    // PDF.js (Mozilla's PDF reader) draws the certificate. It is only downloaded
    // the first time a certificate is opened on a phone.
    const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
    let pdfjsLoading = null;

    function loadPdfJs() {
        if (!pdfjsLoading) {
            pdfjsLoading = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = PDFJS_URL + 'pdf.min.js';
                script.onload = () => {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_URL + 'pdf.worker.min.js';
                    resolve(window.pdfjsLib);
                };
                script.onerror = () => {
                    pdfjsLoading = null;   // try again next time
                    reject(new Error('PDF.js could not be loaded'));
                };
                document.head.append(script);
            });
        }
        return pdfjsLoading;
    }

    // Draws page 1 of the certificate onto the canvas, sharp on high-resolution screens.
    // "drawing" makes sure a slow certificate never draws over one opened after it.
    let drawing = 0;

    async function drawPreview(url) {
        const current = ++drawing;
        try {
            const pdfjsLib = await loadPdfJs();
            const pdf = await pdfjsLib.getDocument(url).promise;
            const page = await pdf.getPage(1);
            if (current !== drawing) return;

            const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
            const fitWidth = pdfPreview.clientWidth / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: fitWidth * pixelRatio });
            pdfPreview.width = viewport.width;    // the canvas takes the certificate's own shape
            pdfPreview.height = viewport.height;
            await page.render({ canvasContext: pdfPreview.getContext('2d'), viewport }).promise;
        } catch (error) {
            if (current !== drawing) return;
            pdfPreview.hidden = true;            // show the "Open PDF" message instead
            pdfFallback.hidden = false;
        }
    }

    function clearPreview() {
        drawing++;
        pdfPreview.width = 842;                  // back to a blank landscape page
        pdfPreview.height = 595;
    }

    // A new <iframe> is used each time, so closing the popup does not
    // leave extra steps in the browser's Back button history
    function setPdf(url) {
        const frame = pdfFrame.cloneNode(false);
        if (url) {
            frame.src = url;
        } else {
            frame.removeAttribute('src');
        }
        pdfFrame.replaceWith(frame);
        pdfFrame = frame;
    }

    document.querySelectorAll('[data-pdf-modal]').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();   // stay on this page instead of opening a new tab
            const url = link.getAttribute('href');

            pdfTitle.textContent = link.dataset.title;
            pdfModal.querySelectorAll('[data-pdf-open]').forEach((a) => { a.href = url; });

            const usePreview = isPhone.matches;
            const useFrame = !usePreview && canShowPdf;
            pdfPreview.hidden = !usePreview;
            pdfFrame.hidden = !useFrame;
            pdfFallback.hidden = usePreview || useFrame;
            if (useFrame) setPdf(url);

            openModal(pdfModal);

            if (usePreview) {
                pdfPreview.setAttribute('aria-label', 'Certificate: ' + link.dataset.title);
                drawPreview(url);   // after opening, so the canvas width can be measured
            }
        });
    });

    pdfModal.addEventListener('close', () => {
        setPdf(null);
        clearPreview();
    });
}

// Project screenshot popup
if (imageModal) {
    const bigImage = document.createElement('img');
    bigImage.className = 'modal__image';
    imageModal.querySelector('.modal__box').append(bigImage);

    document.querySelectorAll('[data-image-modal]').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();   // stay on this page instead of opening the image file
            const thumbnail = link.querySelector('img');
            bigImage.src = link.getAttribute('href');
            bigImage.alt = thumbnail.alt;
            openModal(imageModal);
        });
    });
}


/* 6b. Laptop mockup: tilts the project screenshot onto the laptop's screen.
   The screen in laptop.png is seen at an angle, so its four corners are not a rectangle.
   This works out the 3D "perspective" transform that moves the screenshot's corners
   onto those four points, and redoes it whenever the laptop changes size. */
function perspectiveToCorners(width, height, corners) {
    const adjugate = (m) => [
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
    ];
    const multiply = (a, b) => {
        const c = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                c[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
            }
        }
        return c;
    };
    // Matrix that maps the unit square onto four points (given as [x, y] pairs)
    const fromSquare = ([p1, p2, p3, p4]) => {
        const m = [p1[0], p2[0], p3[0], p1[1], p2[1], p3[1], 1, 1, 1];
        const a = adjugate(m);
        const v = [
            a[0] * p4[0] + a[1] * p4[1] + a[2],
            a[3] * p4[0] + a[4] * p4[1] + a[5],
            a[6] * p4[0] + a[7] * p4[1] + a[8],
        ];
        return multiply(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
    };
    const [topLeft, topRight, bottomRight, bottomLeft] = corners;
    const source = fromSquare([[0, 0], [width, 0], [0, height], [width, height]]);
    const target = fromSquare([topLeft, topRight, bottomLeft, bottomRight]);
    const t = multiply(target, adjugate(source)).map((n, i, all) => n / all[8]);
    return `matrix3d(${t[0]}, ${t[3]}, 0, ${t[6]}, ${t[1]}, ${t[4]}, 0, ${t[7]}, 0, 0, 1, 0, ${t[2]}, ${t[5]}, 0, 1)`;
}

// Works for both mockups: the laptop (laptop.png) and the laptop + phone (laptop2.png)
document.querySelectorAll('[data-laptop-screen]').forEach((screen) => {
    const laptop = screen.closest('.laptop, [data-mockup]');
    const frame = laptop.querySelector('.laptop__frame, .mockup__frame');
    const imageWidth = Number(frame.getAttribute('width'));   // the mockup image's own width

    // Corners in the mockup image's pixels, pushed 1 pixel outward so no gap shows at the screen's edge
    const corners = screen.dataset.corners.split(' ').map((pair) => pair.split(',').map(Number));
    const center = corners.reduce(([x, y], [cx, cy]) => [x + cx / 4, y + cy / 4], [0, 0]);
    const outward = corners.map(([x, y]) => {
        const dx = x - center[0];
        const dy = y - center[1];
        const length = Math.hypot(dx, dy);
        return [x + dx / length, y + dy / length];
    });

    // The screenshot is laid out on a flat screen of this shape (16:10 unless data-screen-size
    // says otherwise), then tilted into place
    const [SCREEN_WIDTH, SCREEN_HEIGHT] = (screen.dataset.screenSize || '400,250').split(',').map(Number);

    function place() {
        // Positions are measured from the screen's positioned parent (the laptop box, or the phone's click area)
        const box = (screen.offsetParent || laptop).getBoundingClientRect();
        const image = frame.getBoundingClientRect();
        if (!image.width) return;
        const scale = image.width / imageWidth;
        const points = outward.map(([x, y]) => [image.left - box.left + x * scale, image.top - box.top + y * scale]);
        screen.style.left = '0';
        screen.style.top = '0';
        screen.style.width = SCREEN_WIDTH + 'px';
        screen.style.height = SCREEN_HEIGHT + 'px';
        screen.style.transformOrigin = '0 0';
        screen.style.transform = perspectiveToCorners(SCREEN_WIDTH, SCREEN_HEIGHT, points);
    }

    new ResizeObserver(place).observe(laptop);
    place();
});


/* 7. Footer year: keeps the copyright year current */
document.getElementById('current-year').textContent = new Date().getFullYear();
