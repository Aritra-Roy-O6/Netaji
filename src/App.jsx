import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const heroVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const heroFragmentShader = `
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  uniform float uSpread;
  varying vec2 vUv;

  float hash(vec2 p) {
    vec3 p2 = vec3(p.xy, 1.0);
    return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f *= f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    v += noise(p * 1.0) * 0.5;
    v += noise(p * 2.0) * 0.25;
    v += noise(p * 4.0) * 0.125;
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);

    float dissolveEdge = uv.y - uProgress * 1.2;
    float noiseValue = fbm(centeredUv * 15.0);
    float d = dissolveEdge + noiseValue * uSpread;

    float pixelSize = 1.0 / uResolution.y;
    float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, d);

    gl_FragColor = vec4(uColor, alpha);
  }
`;

const storyVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const storyFragmentShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uGlow;
  uniform vec2 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }

    return value;
  }

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv - 0.5;
    p.x *= uResolution.x / uResolution.y;

    float time = uTime * 0.08;
    float arc = sin(uProgress * 6.28318) * 0.18;
    vec2 flow = rotate2d(arc + time * 0.35) * p;

    float field = fbm(flow * 2.0 + vec2(time * 0.3, -time * 0.12));
    float cloudA = fbm(flow * 3.1 - vec2(time * 0.18, -time * 0.22));
    float cloudB = fbm(flow * 5.0 + vec2(time * 0.12, time * 0.08));

    float cloudMass = smoothstep(0.26, 0.86, field);
    float cloudDetail = smoothstep(0.34, 0.92, cloudA);
    float mist = smoothstep(0.4, 0.95, cloudB) * 0.28;
    float sun = 0.22 / (length(p - vec2(0.18, -0.28)) * 5.0 + 0.35);
    float horizon = smoothstep(0.95, -0.2, p.y);

    vec3 sky = mix(uColorA, uColorB, smoothstep(-0.35, 0.72, p.y + field * 0.12));
    vec3 cloudColor = mix(vec3(1.0), vec3(0.9, 0.96, 1.0), 0.55);
    vec3 color = sky;

    color = mix(color, cloudColor, cloudMass * 0.52);
    color += cloudDetail * 0.26 * vec3(1.0, 1.0, 1.0);
    color += mist * vec3(0.9, 0.96, 1.0);
    color += sun * vec3(1.0, 1.0, 0.96) * (0.16 + uGlow * 0.08);
    color += horizon * vec3(0.04, 0.08, 0.14);

    float vignette = smoothstep(1.38, 0.08, length(p));
    color *= vignette;

    gl_FragColor = vec4(color, 0.86);
  }
`;

const timelineChapters = [
  {
    year: '1897',
    range: '1897-1912',
    label: 'Childhood in Cuttack',
    title: 'Discipline, study, and a growing inner fire',
    summary:
      'Born on 23 January 1897 in Cuttack, Subhash Chandra Bose grew up in a large, well-regarded Bengali family where scholarship and public duty were expected, not admired from afar.',
    details: [
      'His father Janakinath Bose was a prominent lawyer, and the household emphasized discipline, learning, and civic responsibility.',
      'Schooling at Ravenshaw Collegiate School sharpened both his academic rigor and his inward, contemplative side.',
      'That mix of order and intensity shaped the moral seriousness that later defined his politics.',
    ],
    signal: 'The student',
    image: '/img/student.png',
    accent: '#6f9ed8',
    palette: ['#eaf6ff', '#9ec7f3'],
    glow: 0.36,
  },
  {
    year: '1913',
    range: '1913-1921',
    label: 'Education and awakening',
    title: 'Brilliance met rebellion in the classroom years',
    summary:
      'From Calcutta to Cambridge, Bose stood out as a brilliant student, but academic success never diluted his impatience with imperial authority or racial humiliation.',
    details: [
      'He studied at Presidency College and later Scottish Church College, where nationalist feeling deepened alongside intellectual ambition.',
      'He went to England, prepared for the Indian Civil Service, and passed the exam with distinction.',
      'In 1921 he resigned from the ICS before taking office, choosing anti-colonial struggle over a secure imperial career.',
    ],
    signal: 'The renunciation',
    image: '/img/renuntiation.avif',
    accent: '#5a92d3',
    palette: ['#eef8ff', '#8ebde8'],
    glow: 0.38,
  },
  {
    year: '1921',
    range: '1921-1937',
    label: 'Prison, exile, and organization',
    title: 'A leader was forged through surveillance and confinement',
    summary:
      'Returning to India, Bose joined the national movement under C. R. Das and quickly became one of its most dynamic young organizers, even as imprisonment became a recurring fact of life.',
    details: [
      'He worked through municipal politics, youth mobilization, journalism, and Congress organization in Bengal.',
      'British authorities jailed him repeatedly, seeing both his popularity and his discipline as dangerous.',
      'Years of detention and periods in Europe turned him into a strategist with an international outlook, not only a mass leader.',
    ],
    signal: 'The organizer',
    image: '/img/organizer.avif',
    accent: '#4f86c7',
    palette: ['#f2f9ff', '#84b3e0'],
    glow: 0.42,
  },
  {
    year: '1938',
    range: '1938-1940',
    label: 'Congress presidency and the break',
    title: 'Haripura triumph gave way to ideological collision',
    summary:
      'Bose rose to the presidency of the Indian National Congress in 1938, but his insistence on urgent confrontation with the Raj brought him into sharp conflict with more cautious leadership.',
    details: [
      'At Haripura he presented a modern, industrial, and mobilized vision of a future India.',
      'After winning again in 1939, he faced intense opposition inside the Congress high command.',
      'He resigned and later founded the Forward Bloc, turning from internal argument toward a more militant path.',
    ],
    signal: 'The rupture',
    image: '/img/rupture.webp',
    accent: '#4b7fc1',
    palette: ['#f1f8ff', '#7caad7'],
    glow: 0.44,
  },
  {
    year: '1941',
    range: '1941-1943',
    label: 'The great escape',
    title: 'House arrest could not contain his war strategy',
    summary:
      'Under close British watch in Calcutta, Bose escaped house arrest in January 1941, beginning one of the most dramatic clandestine journeys of the independence era.',
    details: [
      'Disguised and moving through North India, Afghanistan, and beyond, he slipped past the surveillance apparatus built around him.',
      'His route ultimately led through global wartime networks as he searched for support against British rule.',
      'The escape transformed him from domestic dissident into an international revolutionary actor.',
    ],
    signal: 'The disappearance',
    image: '/img/disapperance.jpg',
    accent: '#7098cf',
    palette: ['#eef7ff', '#a8c7ea'],
    glow: 0.34,
  },
  {
    year: '1943',
    range: '1943-1945',
    label: 'Azad Hind and the INA',
    title: 'The call now turned into an army, a government, and a march',
    summary:
      'In Southeast Asia Bose took command of the Indian National Army and led the Provisional Government of Azad Hind, transforming symbolism into military and political momentum.',
    details: [
      'He gave the movement its sharpest emotional vocabulary, popularizing slogans such as Delhi Chalo and Jai Hind.',
      'The INA campaign in Burma and toward India did not secure military victory, but it electrified anti-colonial imagination.',
      'Even in defeat, the INA trials helped widen public sympathy for the cause Bose had embodied.',
    ],
    signal: 'The commander',
    image: '/img/commander.webp',
    accent: '#5f93d1',
    palette: ['#eef7ff', '#93bee9'],
    glow: 0.4,
  },
  {
    year: '1945',
    range: '18 August 1945',
    label: 'Final flight and enduring mystery',
    title: 'The reported air crash closed a life, but not the questions',
    summary:
      'Bose was reported to have died from burns after an air crash in Taihoku, now Taipei, on 18 August 1945. Yet the uncertainty around that final episode kept his end wrapped in debate and national fascination.',
    details: [
      'The reported death came just as World War II was collapsing and the strategic map around him had changed dramatically.',
      'Official inquiries and public memory never fully erased the doubts, rumors, and alternative narratives that followed.',
      'His last chapter became part history, part unresolved legend, ensuring that Netaji remained a living question in independent India.',
    ],
    signal: 'The unanswered ending',
    image: '/img/ending.jpg',
    accent: '#7aa8dd',
    palette: ['#f3faff', '#a6c8eb'],
    glow: 0.34,
  },
];

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0.92, g: 0.9, b: 0.84 };
}

function App() {
  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const heroCanvasRef = useRef(null);
  const headlineRef = useRef(null);
  const storyCanvasRef = useRef(null);
  const footerCanvasRef = useRef(null);
  const storyRef = useRef(null);
  const timelineRef = useRef(null);
  const finaleRef = useRef(null);
  const footerRef = useRef(null);
  const activeYearRef = useRef(null);
  const activeLabelRef = useRef(null);
  const chapterRefs = useRef([]);
  const markerRefs = useRef([]);

  useEffect(() => {
    const page = pageRef.current;
    const hero = heroRef.current;
    const heroCanvas = heroCanvasRef.current;
    const storyCanvas = storyCanvasRef.current;
    const footerCanvas = footerCanvasRef.current;
    const story = storyRef.current;
    const timeline = timelineRef.current;
    const finale = finaleRef.current;
    const footer = footerRef.current;
    const headline = headlineRef.current;
    const activeYear = activeYearRef.current;
    const activeLabel = activeLabelRef.current;
    const chapters = chapterRefs.current.filter(Boolean);
    const markers = markerRefs.current.filter(Boolean);

    if (
      !page ||
      !hero ||
      !heroCanvas ||
      !storyCanvas ||
      !footerCanvas ||
      !story ||
      !timeline ||
      !finale ||
      !footer ||
      !headline ||
      !activeYear ||
      !activeLabel ||
      chapters.length === 0
    ) {
      return undefined;
    }

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
    });

    let lenisRafId = 0;
    let renderRafId = 0;
    let heroProgress = 0;
    let footerProgress = 0;
    let activeChapterIndex = -1;

    const heroScene = new THREE.Scene();
    const heroCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const heroRenderer = new THREE.WebGLRenderer({
      canvas: heroCanvas,
      alpha: true,
      antialias: false,
    });

    const heroRgb = hexToRgb('#ffa722');
    const heroGeometry = new THREE.PlaneGeometry(2, 2);
    const heroMaterial = new THREE.ShaderMaterial({
      vertexShader: heroVertexShader,
      fragmentShader: heroFragmentShader,
      uniforms: {
        uProgress: { value: 0 },
        uResolution: {
          value: new THREE.Vector2(hero.offsetWidth, hero.offsetHeight),
        },
        uColor: {
          value: new THREE.Vector3(heroRgb.r, heroRgb.g, heroRgb.b),
        },
        uSpread: { value: 0.5 },
      },
      transparent: true,
    });

    heroScene.add(new THREE.Mesh(heroGeometry, heroMaterial));

    const footerScene = new THREE.Scene();
    const footerCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const footerRenderer = new THREE.WebGLRenderer({
      canvas: footerCanvas,
      alpha: true,
      antialias: false,
    });

    const footerRgb = hexToRgb('#1e5d0c');
    const footerGeometry = new THREE.PlaneGeometry(2, 2);
    const footerMaterial = new THREE.ShaderMaterial({
      vertexShader: heroVertexShader,
      fragmentShader: heroFragmentShader,
      uniforms: {
        uProgress: { value: 0 },
        uResolution: {
          value: new THREE.Vector2(footer.offsetWidth, footer.offsetHeight),
        },
        uColor: {
          value: new THREE.Vector3(footerRgb.r, footerRgb.g, footerRgb.b),
        },
        uSpread: { value: 0.42 },
      },
      transparent: true,
    });

    footerScene.add(new THREE.Mesh(footerGeometry, footerMaterial));

    const storyScene = new THREE.Scene();
    const storyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const storyRenderer = new THREE.WebGLRenderer({
      canvas: storyCanvas,
      alpha: true,
      antialias: true,
    });

    const storyGeometry = new THREE.PlaneGeometry(2, 2);
    const storyMaterial = new THREE.ShaderMaterial({
      vertexShader: storyVertexShader,
      fragmentShader: storyFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uGlow: { value: timelineChapters[0].glow },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        uColorA: { value: new THREE.Color(timelineChapters[0].palette[0]) },
        uColorB: { value: new THREE.Color(timelineChapters[0].palette[1]) },
      },
      transparent: true,
    });

    storyScene.add(new THREE.Mesh(storyGeometry, storyMaterial));

    const clock = new THREE.Clock();

    const animate = () => {
      heroMaterial.uniforms.uProgress.value = heroProgress;
      footerMaterial.uniforms.uProgress.value = footerProgress;
      storyMaterial.uniforms.uTime.value = clock.getElapsedTime();

      heroRenderer.render(heroScene, heroCamera);
      footerRenderer.render(footerScene, footerCamera);
      storyRenderer.render(storyScene, storyCamera);

      renderRafId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const heroWidth = hero.offsetWidth;
      const heroHeight = hero.offsetHeight;

      heroRenderer.setSize(heroWidth, heroHeight);
      heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      heroMaterial.uniforms.uResolution.value.set(heroWidth, heroHeight);

      storyRenderer.setSize(window.innerWidth, window.innerHeight);
      storyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      storyMaterial.uniforms.uResolution.value.set(
        window.innerWidth,
        window.innerHeight,
      );

      footerRenderer.setSize(footer.offsetWidth, footer.offsetHeight);
      footerRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      footerMaterial.uniforms.uResolution.value.set(
        footer.offsetWidth,
        footer.offsetHeight,
      );
    };

    const handleLenisScroll = ({ scroll }) => {
      const heroHeight = hero.offsetHeight;
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(heroHeight - viewportHeight, 1);

      heroProgress = Math.min((scroll / maxScroll) * 1.05, 1.15);
      ScrollTrigger.update();
    };

    const lenisFrame = (time) => {
      lenis.raf(time);
      lenisRafId = requestAnimationFrame(lenisFrame);
    };

    const updateStoryTheme = (chapter, index) => {
      if (activeChapterIndex === index) {
        return;
      }

      activeChapterIndex = index;
      const nextColorA = new THREE.Color(chapter.palette[0]);
      const nextColorB = new THREE.Color(chapter.palette[1]);

      markers.forEach((marker, markerIndex) => {
        marker.classList.toggle('is-active', markerIndex === index);
      });

      gsap.to(page, {
        '--accent': chapter.accent,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: true,
      });

      gsap.to(storyMaterial.uniforms.uColorA.value, {
        r: nextColorA.r,
        g: nextColorA.g,
        b: nextColorA.b,
        duration: 1.2,
        ease: 'power2.out',
        overwrite: true,
      });

      gsap.to(storyMaterial.uniforms.uColorB.value, {
        r: nextColorB.r,
        g: nextColorB.g,
        b: nextColorB.b,
        duration: 1.2,
        ease: 'power2.out',
        overwrite: true,
      });

      gsap.to(storyMaterial.uniforms.uGlow, {
        value: chapter.glow,
        duration: 1,
        ease: 'power2.out',
        overwrite: true,
      });

      gsap.to([activeYear, activeLabel], {
        y: -18,
        opacity: 0,
        duration: 0.18,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => {
          activeYear.textContent = chapter.year;
          activeLabel.textContent = chapter.label;

          gsap.fromTo(
            [activeYear, activeLabel],
            {
              y: 18,
              opacity: 0,
            },
            {
              y: 0,
              opacity: 1,
              duration: 0.45,
              ease: 'power3.out',
              stagger: 0.04,
            },
          );
        },
      });
    };

    handleResize();
    lenis.on('scroll', handleLenisScroll);
    window.addEventListener('resize', handleResize);
    lenisRafId = requestAnimationFrame(lenisFrame);
    renderRafId = requestAnimationFrame(animate);

    const ctx = gsap.context(() => {
      gsap.to('.hero__twig--left', {
        y: -1800,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('.hero__twig--right', {
        y: -3000,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('.hero__grain', {
        yPercent: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      const words = headline.querySelectorAll('span');
      gsap.set(words, { opacity: 0 });

      ScrollTrigger.create({
        trigger: '.hero__content',
        start: 'top 28%',
        end: 'bottom 95%',
        onUpdate: (self) => {
          const totalWords = words.length;

          words.forEach((word, index) => {
            const wordProgress = index / totalWords;
            const nextWordProgress = (index + 1) / totalWords;
            let opacity = 0;

            if (self.progress >= nextWordProgress) {
              opacity = 1;
            } else if (self.progress >= wordProgress) {
              const fadeProgress =
                (self.progress - wordProgress) /
                (nextWordProgress - wordProgress);
              opacity = Math.max(fadeProgress, 0);
            }

            gsap.to(word, {
              opacity,
              duration: 0.14,
              overwrite: true,
            });
          });
        },
      });

      gsap.from('.prologue__panel', {
        opacity: 0,
        y: 90,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.prologue',
          start: 'top 78%',
        },
      });

      gsap.from('.prologue__stat', {
        opacity: 0,
        y: 40,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.prologue__stats',
          start: 'top 82%',
        },
      });

      gsap.fromTo(
        '.rail__fill',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: timeline,
            start: 'top top+=96',
            end: 'bottom bottom-=96',
            scrub: true,
          },
        },
      );

      ScrollTrigger.create({
        trigger: story,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          storyMaterial.uniforms.uProgress.value = self.progress;
        },
      });

      chapters.forEach((chapter, index) => {
        const panel = chapter.querySelector('.chapter__panel');
        const visual = chapter.querySelector('.chapter__visual');
        const image = chapter.querySelector('.chapter__image');
        const facts = chapter.querySelectorAll('.chapter__fact');
        const halo = chapter.querySelector('.chapter__halo');
        const signal = chapter.querySelector('.chapter__signal');
        const chapterData = timelineChapters[index];

        gsap.fromTo(
          visual,
          {
            opacity: 0,
            y: 110,
            scale: 0.92,
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: chapter,
              start: 'top 76%',
            },
          },
        );

        gsap.to(image, {
          scale: 1.08,
          ease: 'none',
          scrollTrigger: {
            trigger: chapter,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.fromTo(
          panel,
          {
            opacity: 0,
            y: 80,
          },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: chapter,
              start: 'top 72%',
            },
          },
        );

        gsap.fromTo(
          facts,
          {
            opacity: 0,
            y: 28,
          },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.7,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: chapter,
              start: 'top 68%',
            },
          },
        );

        gsap.to(halo, {
          rotate: index % 2 === 0 ? 180 : -180,
          ease: 'none',
          scrollTrigger: {
            trigger: chapter,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.to(signal, {
          yPercent: -18,
          ease: 'none',
          scrollTrigger: {
            trigger: chapter,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });

        ScrollTrigger.create({
          trigger: chapter,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => updateStoryTheme(chapterData, index),
          onEnterBack: () => updateStoryTheme(chapterData, index),
        });
      });

      gsap.from('.finale__lead', {
        opacity: 0,
        y: 80,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: finale,
          start: 'top 78%',
        },
      });

      gsap.from('.finale__card', {
        opacity: 0,
        y: 50,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.finale__cards',
          start: 'top 82%',
        },
      });

      ScrollTrigger.create({
        trigger: footer,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          footerProgress = Math.min(self.progress * 1.15, 1.05);
        },
      });

      ScrollTrigger.create({
        trigger: footer,
        start: 'top center',
        onEnter: () =>
          updateStoryTheme(
            {
              year: 'JAI HIND',
              label: 'Legacy',
              accent: '#6f9ed8',
              palette: ['#eef8ff', '#9fc3e7'],
              glow: 0.34,
            },
            999,
          ),
        onEnterBack: () =>
          updateStoryTheme(
            {
              year: 'JAI HIND',
              label: 'Legacy',
              accent: '#6f9ed8',
              palette: ['#eef8ff', '#9fc3e7'],
              glow: 0.34,
            },
            999,
          ),
      });

      gsap.from('.footer__shell > *', {
        opacity: 0,
        y: 36,
        stagger: 0.08,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: footer,
          start: 'top 78%',
        },
      });
    }, page);

    updateStoryTheme(timelineChapters[0], 0);

    return () => {
      lenis.off('scroll', handleLenisScroll);
      lenis.destroy();
      window.removeEventListener('resize', handleResize);

      cancelAnimationFrame(lenisRafId);
      cancelAnimationFrame(renderRafId);

      ctx.revert();

      heroGeometry.dispose();
      heroMaterial.dispose();
      heroRenderer.dispose();

      storyGeometry.dispose();
      storyMaterial.dispose();
      storyRenderer.dispose();

      footerGeometry.dispose();
      footerMaterial.dispose();
      footerRenderer.dispose();
    };
  }, []);

  const headlineText =
    'From a brilliant student in Cuttack to the supreme commander of a liberation army, Netaji moved through discipline, exile, escape, war, and legend.';

  return (
    <div className="page" ref={pageRef}>
      <section className="hero" ref={heroRef}>
        <div className="hero__row">
          <img
            src="/img/hero-bg.png"
            className="hero__bg"
            alt="A dark and atmospheric forest backdrop"
          />
          <div className="hero__grain"></div>

          <div className="hero__twigs" aria-hidden="true">
            <img
              src="/img/mask-1.png"
              className="hero__twig hero__twig--left"
              alt=""
            />
            <img
              src="/img/mask-2.png"
              className="hero__twig hero__twig--right"
              alt=""
            />
          </div>

          <div className="hero__top">
            <p className="hero__subtitle1">The Legendary</p>
            <h1>NETAJI</h1>
            <p className="hero__subtitle2">Subhash Chandra Bose</p>
          </div>

          <div className="hero__badge">
          </div>

          <canvas className="hero-canvas" ref={heroCanvasRef}></canvas>
        </div>

        <div className="hero__content">
          <h2 ref={headlineRef}>
            {headlineText.split(' ').map((word, index) => (
              <span key={index}>{word}&nbsp;</span>
            ))}
          </h2>
        </div>

      </section>

      <main className="story" ref={storyRef}>
        <div className="story-shader" aria-hidden="true">
          <canvas ref={storyCanvasRef}></canvas>
        </div>
        <section className="prologue section-shell">
          <div className="prologue__panel">
            <div className="prologue__copy">
              <p className="section-tag">Prologue</p>
              <h2>The story never moves in one direction for long.</h2>
              <p>
                Bose&apos;s life accelerated from scholarship to insurgent
                politics, from prison cells to underground routes, and from
                speeches to armies. This page turns that movement into a
                cinematic timeline rather than a static biography.
              </p>
            </div>

            <div className="prologue__stats">
              <div className="prologue__stat">
                <span>23 Jan 1897</span>
                <p>Born in Cuttack, in present-day Odisha.</p>
              </div>
              <div className="prologue__stat">
                <span>Jan 1941</span>
                <p>Escaped British house arrest and vanished into wartime routes.</p>
              </div>
              <div className="prologue__stat">
                <span>18 Aug 1945</span>
                <p>Reported to have died after an air crash in Taihoku, now Taipei.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="timeline section-shell" ref={timelineRef}>
          <div className="timeline__layout">
            <aside className="timeline__rail">
              <p className="section-tag">Timeline</p>
              <div className="rail__headline">
                <span className="rail__year" ref={activeYearRef}>
                  1897
                </span>
                <span className="rail__label" ref={activeLabelRef}>
                  Childhood in Cuttack
                </span>
              </div>

              <div className="rail__track">
                <span className="rail__line"></span>
                <span className="rail__fill"></span>

                <div className="rail__markers">
                  {timelineChapters.map((chapter, index) => (
                    <div
                      className={`rail__marker ${index === 0 ? 'is-active' : ''}`}
                      key={chapter.year}
                      ref={(element) => {
                        markerRefs.current[index] = element;
                      }}
                    >
                      <span className="rail__dot"></span>
                      <span className="rail__marker-copy">
                        <strong>{chapter.year}</strong>
                        <small>{chapter.label}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className="timeline__chapters">
              {timelineChapters.map((chapter, index) => (
                <article
                  className={`chapter ${index % 2 === 1 ? 'chapter--reverse' : ''}`}
                  key={`${chapter.year}-${chapter.label}`}
                  ref={(element) => {
                    chapterRefs.current[index] = element;
                  }}
                >
                  <div className="chapter__inner">
                    <div className="chapter__visual">
                      <img
                        className="chapter__image"
                        src={chapter.image}
                        alt={chapter.label}
                      />
                      <span className="chapter__index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="chapter__year">{chapter.year}</span>
                      <span className="chapter__signal">{chapter.signal}</span>
                      <div className="chapter__halo"></div>
                      <div className="chapter__orbits" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>

                    <div className="chapter__panel">
                      <p className="chapter__range">{chapter.range}</p>
                      <h3>{chapter.title}</h3>
                      <p className="chapter__summary">{chapter.summary}</p>

                      <ul className="chapter__facts">
                        {chapter.details.map((detail) => (
                          <li className="chapter__fact" key={detail}>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="finale section-shell" ref={finaleRef}>
          <div className="finale__grid">
            <div className="finale__lead">
              <p className="section-tag">Epilogue</p>
              <h2>A life that became more powerful after the battlefield fell silent.</h2>
              <p>
                Netaji&apos;s military project did not secure independence on
                its own terms, but it changed the emotional and political
                atmosphere of late colonial India. His memory endures because
                he represented action under impossible conditions.
              </p>
            </div>

            <div className="finale__cards">
              <article className="finale__card">
                <span>Legacy</span>
                <p>
                  The INA trials helped turn soldiers, slogans, and sacrifice
                  into a mass public conversation across India.
                </p>
              </article>
              <article className="finale__card">
                <span>Debate</span>
                <p>
                  The reported 1945 death never fully ended public speculation,
                  which is why Bose remains both a historical figure and an
                  unresolved national myth.
                </p>
              </article>
              <article className="finale__card">
                <span>Memory</span>
                <p>
                  Netaji&apos;s image still stands for fearless urgency,
                  disciplined leadership, and a refusal to accept submission as
                  destiny.
                </p>
              </article>
            </div>
          </div>
        </section>

        <footer className="footer" ref={footerRef}>
          <div className="footer__row">
            <div className="footer__grain"></div>

            <div className="footer__top">
              <p className="footer__eyebrow">Unfinished. Unforgotten.</p>
              <h2>JAI HIND</h2>
              <p className="footer__subtitle">Netaji Subhash Chandra Bose</p>
            </div>

            <canvas className="footer__canvas" ref={footerCanvasRef}></canvas>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
