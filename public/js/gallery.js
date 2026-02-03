document.addEventListener('DOMContentLoaded', () => {
    const galleryContainer = document.getElementById('gallery-container');
    const header = document.querySelector('.gallery-page-header');

    // Scroll Effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Observer for fade-in animation
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    async function loadGallery() {
        try {
            const res = await fetch('/api/photos');
            const photos = await res.json();

            // Shuffle slightly for "Artistic" random look or keep sorted. Keeping sorted for now.

            if (photos.length === 0) {
                galleryContainer.innerHTML = '<div class="loading">暂无作品</div>';
                return;
            }

            // Group photos by category
            const categories = {};
            const seriesMap = {};

            photos.forEach(photo => {
                // Ensure consistency
                const cat = (photo.category || 'other').toLowerCase();
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(photo);

                // Group by Series
                if (photo.series) {
                    if (!seriesMap[photo.series]) seriesMap[photo.series] = [];
                    seriesMap[photo.series].push(photo);
                }
            });

            // Clear container
            galleryContainer.innerHTML = '';

            // Define display order and titles
            const categoryConfig = [
                { key: 'nature', title: 'Nature 自然' },
                { key: 'urban', title: 'Urban 城市' },
                { key: 'portrait', title: 'Portrait 人像' }
            ];

            // Track the order of photos as they are rendered
            const sortedPhotos = [];

            // Helper to render and track
            const processAndRender = (title, group) => {
                if (!group || group.length === 0) return;
                renderSection(galleryContainer, title, group);
                sortedPhotos.push(...group);
            };

            // Render known categories first
            categoryConfig.forEach(config => {
                const group = categories[config.key];
                if (group) {
                    processAndRender(config.title, group);
                    delete categories[config.key];
                }
            });

            // Render remaining categories
            Object.keys(categories).forEach(key => {
                const group = categories[key];
                const title = key.charAt(0).toUpperCase() + key.slice(1);
                processAndRender(title, group);
            });

            // Render Series (Collections)
            if (Object.keys(seriesMap).length > 0) {
                const separator = document.createElement('div');
                separator.innerHTML = `<h2 class="category-title" style="margin-top: 60px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 40px; color: #fff;">Featured Collections 精选系列</h2>`;
                galleryContainer.appendChild(separator);

                Object.keys(seriesMap).forEach(seriesName => {
                    processAndRender(`· ${seriesName}`, seriesMap[seriesName]);
                });
            }

            function renderSection(container, title, items) {
                const section = document.createElement('div');
                section.className = 'category-section';
                section.innerHTML = `
                    <h2 class="category-title">${title}</h2>
                    <div class="category-grid">
                        ${items.map(photo => `
                            <div class="gallery-item">
                                <img src="${photo.url}" alt="${photo.title}" class="gallery-img" loading="lazy">
                                <div class="item-info">
                                    <div class="item-title">${photo.title}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(section);
            }

            // Observe elements for animation
            const items = document.querySelectorAll('.gallery-item');
            items.forEach((item, index) => {
                item.style.transitionDelay = `${(index % 5) * 0.1}s`; // Stagger across section
                observer.observe(item);
            });

            // Use the Sorted Photos for Lightbox so indices match DOM order
            setupLightbox(sortedPhotos);

        } catch (err) {
            console.error(err);
            galleryContainer.innerHTML = '<div class="loading">加载失败</div>';
        }
    }

    // Reuse Lightbox Logic (Mini Version)
    function setupLightbox(photos) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <button class="lightbox-close" aria-label="关闭">&times;</button>
            <button class="lightbox-nav prev" aria-label="上一张">&#10094;</button>
            <div class="lightbox-content">
                <img class="lightbox-img" src="" alt="">
                
                <button class="lightbox-info-toggle" aria-label="显示信息">i</button>
                
                <div class="lightbox-info-panel">
                    <div class="info-title"></div>
                    <div class="info-date"></div>
                    <div class="info-exif"></div>
                </div>
            </div>
            <button class="lightbox-nav next" aria-label="下一张">&#10095;</button>
        `;
        document.body.appendChild(lightbox);

        const imgEl = lightbox.querySelector('.lightbox-img');
        const titleEl = lightbox.querySelector('.info-title');
        const dateEl = lightbox.querySelector('.info-date');
        const exifEl = lightbox.querySelector('.info-exif');
        const panelEl = lightbox.querySelector('.lightbox-info-panel');
        const toggleBtn = lightbox.querySelector('.lightbox-info-toggle');

        let currentIndex = 0;

        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            panelEl.classList.toggle('visible');
        };

        const open = (index) => {
            currentIndex = index;
            const photo = photos[index];
            imgEl.src = photo.url;

            titleEl.textContent = photo.title;
            dateEl.textContent = photo.date ? new Date(photo.date).toLocaleDateString() : '';

            exifEl.innerHTML = '';
            if (photo.exif) {
                const items = [
                    photo.exif.camera,
                    photo.exif.lens,
                    photo.exif.aperture,
                    photo.exif.shutter,
                    photo.exif.iso ? `ISO ${photo.exif.iso}` : '',
                    photo.exif.focal
                ].filter(Boolean);

                items.forEach(val => {
                    exifEl.innerHTML += `<div class="exif-item">${val}</div>`;
                });
            } else {
                exifEl.innerHTML = '<div style="color: #666; grid-column: 1 / -1;">No EXIF Data</div>';
            }

            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
            resetZoom();
            panelEl.classList.remove('visible'); // Pure mode by default
        };

        const close = () => {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        };

        const next = (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % photos.length; open(currentIndex); };
        const prev = (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + photos.length) % photos.length; open(currentIndex); };

        lightbox.querySelector('.lightbox-close').onclick = close;
        lightbox.querySelector('.next').onclick = next;
        lightbox.querySelector('.prev').onclick = prev;
        lightbox.onclick = (e) => { if (e.target === lightbox) close(); };

        document.querySelectorAll('.gallery-item').forEach((item, index) => {
            item.onclick = () => open(index);
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') next(e);
            if (e.key === 'ArrowLeft') prev(e);
        });
        // === Zoom & Pan Logic (Gallery) ===
        let scale = 1;
        let panning = false;
        let pointX = 0;
        let pointY = 0;
        let startX = 0;
        let startY = 0;

        const setTransform = () => {
            imgEl.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        };

        const resetZoom = () => {
            scale = 1;
            pointX = 0;
            pointY = 0;
            setTransform();
        };

        imgEl.style.transition = 'transform 0.1s ease-out';
        imgEl.style.cursor = 'grab';

        imgEl.onmousedown = (e) => {
            if (scale > 1) {
                e.preventDefault();
                startX = e.clientX - pointX;
                startY = e.clientY - pointY;
                panning = true;
                imgEl.style.cursor = 'grabbing';
            }
        };

        window.addEventListener('mouseup', () => {
            panning = false;
            imgEl.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', (e) => {
            if (!panning) return;
            e.preventDefault();
            pointX = e.clientX - startX;
            pointY = e.clientY - startY;
            setTransform();
        });

        imgEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                scale *= 1.1;
            } else {
                scale /= 1.1;
            }
            scale = Math.min(Math.max(1, scale), 5);
            setTransform();
        });

        imgEl.ondblclick = () => {
            if (scale === 1) {
                scale = 2;
            } else {
                scale = 1;
                pointX = 0;
                pointY = 0;
            }
            setTransform();
        };
    }

    loadGallery();
});
