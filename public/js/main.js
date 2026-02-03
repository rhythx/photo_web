document.addEventListener('DOMContentLoaded', () => {
    // === Variables ===
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navList = document.querySelector('.nav-list');
    const navLinks = document.querySelectorAll('.nav-link');
    const heroContent = document.querySelector('.hero-content');
    const galleryGrid = document.getElementById('gallery-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const viewBtns = document.querySelectorAll('.view-btn');

    // Lightbox Elements
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';

    // Lightbox Inner Structure
    lightbox.innerHTML = `
        <button class="lightbox-close" aria-label="关闭">&times;</button>
        <button class="lightbox-nav prev" aria-label="上一张">&#10094;</button>
        <div class="lightbox-content">
            <img class="lightbox-img" src="" alt="">
            <!-- Info Toggle -->
            <button class="lightbox-info-toggle" aria-label="显示信息">i</button>
            <!-- Info Panel -->
            <div class="lightbox-info-panel">
                <div class="info-title"></div>
                <div class="info-date"></div>
                <div class="info-exif"></div>
            </div>
        </div>
        <button class="lightbox-nav next" aria-label="下一张">&#10095;</button>
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('.lightbox-img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox.querySelector('.prev');
    const lightboxNext = lightbox.querySelector('.next');

    const infoTitle = lightbox.querySelector('.info-title');
    const infoDate = lightbox.querySelector('.info-date');
    const infoExif = lightbox.querySelector('.info-exif');
    const infoPanel = lightbox.querySelector('.lightbox-info-panel');
    const infoToggle = lightbox.querySelector('.lightbox-info-toggle');

    // Toggle Info
    infoToggle.onclick = (e) => {
        e.stopPropagation();
        infoPanel.classList.toggle('visible');
    };

    let currentImageIndex = 0;
    let visibleItems = []; // Items currently shown by filter
    let galleryItems = []; // All gallery items
    let galleryData = []; // Store full photo objects


    // === Fetch Photos ===
    async function loadGallery() {
        try {
            const res = await fetch('/api/photos');
            galleryData = await res.json();
            const photos = galleryData;

            galleryGrid.innerHTML = photos.map(photo => `
                <div class="gallery-item" data-category="${photo.category}">
                    <img src="${photo.url}" alt="${photo.title}" class="gallery-img" loading="lazy">
                    <div class="gallery-overlay">
                        <span class="btn">查看</span>
                    </div>
                </div>
            `).join('');

            // Re-select items after injection
            galleryItems = document.querySelectorAll('.gallery-item');
            visibleItems = Array.from(galleryItems);

            // Re-attach listeners
            attachItemListeners();

        } catch (err) {
            console.error('Failed to load photos:', err);
            galleryGrid.innerHTML = '<p>加载作品失败，请稍后重试。</p>';
        }
    }

    // === Header Scroll Effect ===
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });

    // === Mobile Menu ===
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navList.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navList.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    });

    // === Hero Animation ===
    if (heroContent) {
        setTimeout(() => heroContent.classList.add('visible'), 300);
    }

    // === Filtering ===
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update Active State
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            // Filter Items
            visibleItems = [];
            galleryItems.forEach(item => {
                const category = item.getAttribute('data-category');
                if (filterValue === 'all' || category === filterValue) {
                    item.style.display = 'block';
                    // Re-trigger animation
                    item.style.animation = 'none';
                    item.offsetHeight; /* trigger reflow */
                    item.style.animation = 'fadeIn 0.5s ease forwards';
                    visibleItems.push(item);
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // === View Toggle (Grid / Masonry) ===
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const viewType = btn.getAttribute('data-view');

            if (viewType === 'masonry') {
                galleryGrid.classList.add('masonry');
            } else {
                galleryGrid.classList.remove('masonry');
            }
        });
    });

    // === Lightbox Logic ===
    const openLightbox = (index) => {
        currentImageIndex = index;
        const item = visibleItems[index];
        const img = item.querySelector('.gallery-img');

        // Match photo data by URL
        // (Note: src might be absolute, so we check inclusion)
        const photoData = galleryData.find(p => img.src.includes(p.url));

        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;

        if (photoData) {
            infoTitle.textContent = photoData.title;
            infoDate.textContent = photoData.date ? new Date(photoData.date).toLocaleDateString() : '';

            infoExif.innerHTML = '';
            if (photoData.exif) {
                const items = [
                    photoData.exif.camera,
                    photoData.exif.lens,
                    photoData.exif.aperture,
                    photoData.exif.shutter,
                    photoData.exif.iso ? `ISO ${photoData.exif.iso}` : '',
                    photoData.exif.focal
                ].filter(Boolean);

                items.forEach(val => {
                    infoExif.innerHTML += `<div class="exif-item">${val}</div>`;
                });
            } else {
                infoExif.innerHTML = '<div style="color: #666; grid-column: 1 / -1;">No EXIF Data</div>';
            }
        } else {
            infoTitle.textContent = img.alt;
            infoExif.innerHTML = '';
        }

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Disable scroll
        resetZoom(); // Reset zoom on open
        infoPanel.classList.remove('visible'); // Pure Mode by default
    };

    const closeLightbox = () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    };

    const showNext = () => {
        if (visibleItems.length === 0) return;
        currentImageIndex = (currentImageIndex + 1) % visibleItems.length;
        openLightbox(currentImageIndex);
    };

    const showPrev = () => {
        if (visibleItems.length === 0) return;
        currentImageIndex = (currentImageIndex - 1 + visibleItems.length) % visibleItems.length;
        openLightbox(currentImageIndex);
    };

    function attachItemListeners() {
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                // Find index in current visibleItems
                const index = visibleItems.indexOf(item);
                if (index !== -1) openLightbox(index);
            });
        });
    }

    // Lightbox Controls
    lightboxClose.addEventListener('click', closeLightbox);

    lightboxPrev.onclick = (e) => { e.stopPropagation(); showPrev(); };
    lightboxNext.onclick = (e) => { e.stopPropagation(); showNext(); };

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
            closeLightbox();
        }
    });

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
    });

    // Touch Gestures (Simple Swipe)
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    const handleSwipe = () => {
        if (scale > 1) return; // Disable swipe nav if zoomed in
        if (touchEndX < touchStartX - 50) showNext(); // Swipe Left -> Next
        if (touchEndX > touchStartX + 50) showPrev(); // Swipe Right -> Prev
    };

    // === Zoom & Pan Logic ===
    let scale = 1;
    let panning = false;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;

    const setTransform = () => {
        lightboxImg.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    };

    const resetZoom = () => {
        scale = 1;
        pointX = 0;
        pointY = 0;
        setTransform();
    };

    lightboxImg.onmousedown = (e) => {
        if (scale > 1) { // Only pan if zoomed
            e.preventDefault();
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            panning = true;
        }
    };

    window.addEventListener('mouseup', () => {
        panning = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (!panning) return;
        e.preventDefault();
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        setTransform();
    });

    lightboxImg.addEventListener('wheel', (e) => {
        e.preventDefault();

        // Calculate zoom
        if (e.deltaY < 0) {
            scale *= 1.1;
        } else {
            scale /= 1.1;
        }

        // Clamp scale
        scale = Math.min(Math.max(1, scale), 5);

        setTransform();
    });

    // Double click to toggle zoom
    lightboxImg.ondblclick = () => {
        if (scale === 1) {
            scale = 2;
        } else {
            scale = 1;
            pointX = 0;
            pointY = 0;
        }
        setTransform();
    };

    // Initialize
    loadGallery();
});
