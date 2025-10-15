document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const countrySearchForm = document.getElementById('country-search-form');
    const countrySearchInput = document.getElementById('country-search-input');
    const movieModal = document.getElementById('movie-modal');
    const actorModal = document.getElementById('actor-modal');
    const genreNav = document.getElementById('genre-nav');
    const movieGrid = document.getElementById('movie-grid');
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageNumberSpan = document.getElementById('page-number');
    const moviesSection = document.getElementById('movies-section');
    const mapSection = document.getElementById('map-section');
    const viewToggleLink = document.getElementById('view-toggle-link');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');
    const favoritesBtn = document.getElementById('favorites-btn');
    const backToTopBtn = document.getElementById('back-to-top-btn');

    const API_KEY = '518c552f3fe02e930f36f5a8a7f1d613';
    const imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
    const profileBaseUrl = 'https://image.tmdb.org/t/p/w185';
    const fullProfileUrl = 'https://image.tmdb.org/t/p/w500';

    let moviesData = [], genres = [], countries = [];
    let currentPage = 1, totalPages = 1;
    let currentSearchTerm = '', currentGenreId = null;
    let map = null, geojsonLayer = null, searchTimeout = null, tileLayer = null;
    let favoriteMovies = JSON.parse(localStorage.getItem('favoriteMovies')) || [];

    const tileUrls = {
        dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
    };
    
    const mapAttribution = '&copy; CARTO | Desenvolvido por RICHARD V DUARTE';

    function applyTheme(theme) {
        document.documentElement.classList.toggle('light-mode', theme === 'light');
        themeIcon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', theme);
        if (map && tileLayer) {
            tileLayer.setUrl(tileUrls[theme]);
        }
    }

    function showMoviesView() {
        moviesSection.style.display = 'block';
        mapSection.style.display = 'none';
        searchForm.style.display = 'flex';
        countrySearchForm.style.display = 'none';
        viewToggleLink.textContent = 'Explorador Global';
    }

    function showMapView() {
        moviesSection.style.display = 'none';
        mapSection.style.display = 'block';
        searchForm.style.display = 'none';
        countrySearchForm.style.display = 'flex';
        viewToggleLink.textContent = 'Catálogo de Filmes';
        if (map === null) initializeMap();
    }

    async function initializeMap() {
        map = L.map('map', { maxBounds: [[-85, -180], [85, 180]], minZoom: 2, zoomControl: false }).setView([20, 0], 2);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        const currentTheme = localStorage.getItem('theme') || 'dark';
        tileLayer = L.tileLayer(tileUrls[currentTheme], { attribution: mapAttribution }).addTo(map);
        await loadCountriesOnMap();
    }

    async function loadCountriesOnMap() {
        try {
            const [countriesRes, geojsonRes] = await Promise.all([
                fetch('https://restcountries.com/v3.1/all?fields=name,capital,population,flags,cca3,latlng,translations'),
                fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
            ]);
            countries = await countriesRes.json();
            const geojsonData = await geojsonRes.json();
            geojsonLayer = L.geoJson(geojsonData, { style, onEachFeature }).addTo(map);
        } catch (error) { console.error("Erro ao carregar dados dos países:", error); }
    }

    const style = { color: "#555", weight: 1, opacity: 1, fillColor: "#333", fillOpacity: 0.6 };
    const highlightStyle = { weight: 2, color: 'var(--primary-color)', fillColor: 'var(--primary-color)', fillOpacity: 0.7 };

    function onEachFeature(feature, layer) {
        layer.on({
            mouseover: e => e.target.setStyle(highlightStyle),
            mouseout: e => geojsonLayer.resetStyle(e.target),
            click: e => {
                const country = countries.find(c => c.cca3 === feature.id);
                if (country) {
                    const popupContent = `<div style="text-align: center;">
                        <img src="${country.flags.svg}" alt="Bandeira" style="width: 80px; border: 1px solid #555; margin-bottom: 5px;">
                        <h3 style="margin: 5px 0;">${country.name.common}</h3>
                        <p style="margin: 3px 0;"><strong>Capital:</strong> ${country.capital ? country.capital[0] : 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>População:</strong> ${country.population.toLocaleString('pt-BR')}</p>
                    </div>`;
                    layer.bindPopup(popupContent).openPopup();
                }
            }
        });
    }

    countrySearchForm.addEventListener('submit', e => {
        e.preventDefault();
        const searchTerm = countrySearchInput.value.trim().toLowerCase();
        const country = countries.find(c => c.name.common.toLowerCase() === searchTerm || c.translations?.por?.common.toLowerCase() === searchTerm);
        if (country?.latlng) {
            map.flyTo([country.latlng[0], country.latlng[1]], 5);
        } else {
            alert('País não encontrado.');
        }
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = searchInput.value.trim();
            showMoviesView();
            currentPage = 1;
            currentSearchTerm = searchTerm;
            currentGenreId = null;
            deactivateFilterButtons();
            fetchAndDisplayMovies(buildApiUrl());
        }, 500);
    });

    async function fetchAndDisplayMovies(url) {
        movieGrid.innerHTML = '';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha ao buscar filmes.');
            const data = await response.json();
            moviesData = data.results;
            totalPages = data.total_pages;
            updatePagination();
            paginationContainer.style.display = moviesData.length > 0 ? 'flex' : 'none';
            if (moviesData.length === 0) {
                movieGrid.innerHTML = `<p style="color: var(--text-dark);">Nenhum filme encontrado.</p>`;
            } else {
                displayMovies(moviesData);
            }
        } catch (error) {
            movieGrid.innerHTML = `<p style="color: var(--text-dark);">${error.message}</p>`;
        }
    }

    function displayMovies(movies) {
        movieGrid.innerHTML = '';
        movies.forEach(movie => {
            if (movie.poster_path) {
                const moviePoster = document.createElement('div');
                moviePoster.className = 'movie-poster';
                const imageUrl = imageBaseUrl + movie.poster_path;
                const isFavorited = favoriteMovies.includes(movie.id);
                moviePoster.innerHTML = `
                    <img src="${imageUrl}" alt="${movie.title}">
                    <i class="favorite-icon fas fa-heart ${isFavorited ? 'active' : ''}" data-movie-id="${movie.id}"></i>
                `;
                moviePoster.querySelector('img').addEventListener('click', () => openMovieModal(movie.id));
                movieGrid.appendChild(moviePoster);
            }
        });
    }
    
    movieGrid.addEventListener('click', e => {
        if (e.target.classList.contains('favorite-icon')) {
            const movieId = parseInt(e.target.dataset.movieId);
            e.target.classList.toggle('active');
            if (favoriteMovies.includes(movieId)) {
                favoriteMovies = favoriteMovies.filter(id => id !== movieId);
            } else {
                favoriteMovies.push(movieId);
            }
            localStorage.setItem('favoriteMovies', JSON.stringify(favoriteMovies));
            if (favoritesBtn.classList.contains('active')) {
                displayFavoriteMovies();
            }
        }
    });

    async function displayFavoriteMovies() {
        movieGrid.innerHTML = '';
        paginationContainer.style.display = 'none';
        deactivateFilterButtons();
        favoritesBtn.classList.add('active');
        if (favoriteMovies.length === 0) {
            movieGrid.innerHTML = `<p style="color: var(--text-dark);">Você ainda não adicionou filmes aos favoritos.</p>`;
            return;
        }
        const moviePromises = favoriteMovies.map(id => fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&language=pt-BR`).then(res => res.json()));
        try {
            const favoriteMovieDetails = await Promise.all(moviePromises);
            moviesData = favoriteMovieDetails;
            displayMovies(favoriteMovieDetails);
        } catch (error) {
            movieGrid.innerHTML = `<p style="color: var(--text-dark);">Erro ao carregar favoritos.</p>`;
        }
    }
    
    favoritesBtn.addEventListener('click', displayFavoriteMovies);

    async function openMovieModal(movieId) {
        movieModal.style.display = 'flex';
        const modalBody = movieModal.querySelector('#modal-body');
        modalBody.innerHTML = '<div id="modal-trailer"></div><div id="modal-main-info" class="modal-details-flex"></div><div id="modal-cast" class="modal-section" style="display: none;"><h3>Elenco Principal</h3><div class="cast-grid"></div></div><div id="modal-similar" class="modal-section" style="display: none;"><h3>Filmes Similares</h3><div class="similar-movies-grid grid-container"></div></div>';

        try {
            const movieDetailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pt-BR`;
            const detailsResponse = await fetch(movieDetailsUrl);
            if (!detailsResponse.ok) throw new Error('Detalhes do filme não encontrados.');
            const movie = await detailsResponse.json();
            modalBody.querySelector('#modal-main-info').innerHTML = `<img src="${imageBaseUrl + movie.poster_path}" alt="${movie.title}"><div class="modal-movie-details"><h2>${movie.title}</h2><p>${movie.overview || "Sinopse não disponível."}</p><div class="details-meta"><span class="meta-rating">⭐ ${movie.vote_average.toFixed(1)}</span><span class="meta-date">Lançamento: ${new Date(movie.release_date).toLocaleDateString('pt-BR')}</span></div></div>`;
            
            const videoUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${API_KEY}&language=pt-BR`;
            const videoResponse = await fetch(videoUrl);
            const videoData = await videoResponse.json();
            const trailer = videoData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
            if (trailer) modalBody.querySelector('#modal-trailer').innerHTML = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen></iframe></div>`;

            const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}&language=pt-BR`;
            const creditsResponse = await fetch(creditsUrl);
            const creditsData = await creditsResponse.json();
            const cast = creditsData.cast.slice(0, 5);
            if (cast.length > 0) {
                const castSection = modalBody.querySelector('#modal-cast');
                const castGrid = castSection.querySelector('.cast-grid');
                castSection.style.display = 'block';
                cast.forEach(actor => { if (actor.profile_path) { const el = document.createElement('div'); el.className = 'cast-member'; el.innerHTML = `<img src="${profileBaseUrl + actor.profile_path}" alt="${actor.name}"><p>${actor.name}</p>`; el.addEventListener('click', () => openActorModal(actor.id)); castGrid.appendChild(el); } });
            }

            const similarUrl = `https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${API_KEY}&language=pt-BR&page=1`;
            const similarResponse = await fetch(similarUrl);
            const similarData = await similarResponse.json();
            const similarMovies = similarData.results.slice(0, 5);
            if (similarMovies.length > 0) {
                const similarSection = modalBody.querySelector('#modal-similar');
                const similarGrid = similarSection.querySelector('.similar-movies-grid');
                similarSection.style.display = 'block';
                similarMovies.forEach(simMovie => {
                    if (simMovie.poster_path) {
                        const el = document.createElement('div');
                        el.className = 'movie-poster';
                        el.innerHTML = `<img src="${imageBaseUrl + simMovie.poster_path}" alt="${simMovie.title}">`;
                        el.addEventListener('click', e => { e.stopPropagation(); openMovieModal(simMovie.id); });
                        similarGrid.appendChild(el);
                    }
                });
            }
        } catch (error) {
            modalBody.innerHTML = `<p>${error.message}</p>`;
        }
    }
    
    async function openActorModal(actorId) {
        actorModal.style.display = 'flex';
        const modalBody = actorModal.querySelector('#actor-modal-body');
        modalBody.innerHTML = '';
        
        try {
            const actorDetailsUrl = `https://api.themoviedb.org/3/person/${actorId}?api_key=${API_KEY}&language=pt-BR`;
            const creditsUrl = `https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=${API_KEY}&language=pt-BR`;

            const [detailsRes, creditsRes] = await Promise.all([fetch(actorDetailsUrl), fetch(creditsUrl)]);
            if (!detailsRes.ok) throw new Error('Detalhes do ator não encontrados.');
            
            const actor = await detailsRes.json();
            const credits = await creditsRes.json();
            
            const filmography = credits.cast.sort((a, b) => b.popularity - a.popularity).slice(0, 10);
            
            modalBody.innerHTML = `<div id="actor-details"><img src="${fullProfileUrl + actor.profile_path}" alt="${actor.name}"><div id="actor-info"><h2>${actor.name}</h2><p>${actor.biography || 'Biografia não disponível.'}</p></div></div><div class="modal-section"><h3>Filmografia Principal</h3><div class="actor-filmography-grid grid-container"></div></div>`;
            
            const filmographyGrid = modalBody.querySelector('.actor-filmography-grid');
            filmography.forEach(movie => {
                if (movie.poster_path) {
                    const el = document.createElement('div');
                    el.className = 'movie-poster';
                    el.innerHTML = `<img src="${imageBaseUrl + movie.poster_path}" alt="${movie.title}">`;
                    el.addEventListener('click', () => { closeModal(actorModal); openMovieModal(movie.id); });
                    filmographyGrid.appendChild(el);
                }
            });
        } catch(error) {
            modalBody.innerHTML = `<p>${error.message}</p>`;
        }
    }

    function closeModal(modalElement) {
        modalElement.style.display = 'none';
        const iframe = modalElement.querySelector('iframe');
        if (iframe) iframe.src = iframe.src;
    }

    function updatePagination() {
        pageNumberSpan.textContent = `Página ${currentPage} de ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    function buildApiUrl() {
        if (currentSearchTerm) return `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=pt-BR&query=${currentSearchTerm}&page=${currentPage}`;
        if (currentGenreId) return `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=pt-BR&with_genres=${currentGenreId}&page=${currentPage}`;
        return `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=pt-BR&page=${currentPage}`;
    }

    function deactivateFilterButtons() {
        document.querySelectorAll('.genre-link, #favorites-btn').forEach(btn => btn.classList.remove('active'));
    }

    async function fetchGenres() {
        try {
            const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}&language=pt-BR`;
            const response = await fetch(url);
            const data = await response.json();
            genres = data.genres;
            displayGenres();
        } catch (error) { console.error('Falha ao buscar gêneros:', error); }
    }

    function displayGenres() {
        genres.forEach(genre => {
            const genreLink = document.createElement('a');
            genreLink.className = 'genre-link';
            genreLink.dataset.genreId = genre.id;
            genreLink.textContent = genre.name;
            genreLink.addEventListener('click', e => {
                e.preventDefault();
                showMoviesView();
                currentPage = 1;
                currentSearchTerm = '';
                searchInput.value = '';
                currentGenreId = genre.id;
                deactivateFilterButtons();
                genreLink.classList.add('active');
                fetchAndDisplayMovies(buildApiUrl());
            });
            genreNav.appendChild(genreLink);
        });
    }
    
    viewToggleLink.addEventListener('click', e => {
        e.preventDefault();
        moviesSection.style.display === 'block' ? showMapView() : showMoviesView();
    });
    
    themeToggle.addEventListener('click', () => applyTheme(document.documentElement.classList.contains('light-mode') ? 'dark' : 'light'));
    
    window.addEventListener('scroll', () => backToTopBtn.classList.toggle('show', window.scrollY > 300));
    
    backToTopBtn.addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

    movieModal.querySelector('.close-modal-btn').addEventListener('click', () => closeModal(movieModal));
    actorModal.querySelector('.close-modal-btn').addEventListener('click', () => closeModal(actorModal));
    movieModal.addEventListener('click', e => { if (e.target === movieModal) closeModal(movieModal); });
    actorModal.addEventListener('click', e => { if (e.target === actorModal) closeModal(actorModal); });
    
    prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; fetchAndDisplayMovies(buildApiUrl()); } });
    nextPageBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; fetchAndDisplayMovies(buildApiUrl()); } });

    async function initializeApp() {
        applyTheme(localStorage.getItem('theme') || 'dark');
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        if (view === 'map') {
            showMapView();
        } else {
            showMoviesView();
            await fetchGenres();
            const actionGenre = genres.find(g => g.name === 'Ação');
            if (actionGenre) {
                currentGenreId = actionGenre.id;
                const activeLink = document.querySelector(`[data-genre-id='${currentGenreId}']`);
                if(activeLink) activeLink.classList.add('active');
                fetchAndDisplayMovies(buildApiUrl());
            } else {
                fetchAndDisplayMovies(buildApiUrl());
            }
        }
    }

    initializeApp();
});