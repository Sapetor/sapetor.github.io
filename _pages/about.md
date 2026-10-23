---
layout: about
title: about
slug: about
permalink: /
subtitle: Associate Professor, Faculty of Engineering and Sciences, Universidad Adolfo Ibáñez
hero: true
hero_role: Associate Professor, Faculty of Engineering and Sciences
hero_affiliation: Universidad Adolfo Ibáñez, Santiago, Chile
hero_statement: >
  I work on control theory for multi-agent systems, mainly vehicle platoons: how disturbances propagate along a string
  of vehicles, how unreliable communication changes that, and which performance limits no controller can beat.

seo:
  description: >
    Associate Professor at Universidad Adolfo Ibáñez specializing in control systems theory, 
    multi-agent systems, and formation control. Research focuses on decentralized control, 
    vehicle platooning, and string stability analysis.
  keywords: Andres Peters, Andrés Peters, control systems, vehicle platoons, string stability, formation control, UAI Chile
  alternate_names:
    - Andres Peters
    - Andres A Peters
    - Andres A. Peters
    - Peters Andres
    - Andres Peters UAI
    - Peters, A.
    - Peters, Andres A.
    - A. Peters,
    - Andrés Peters Universidad Adolfo Ibáñez

profile:
  align: right
  image: prof_pic.jpg
  alt_text: "Profile photo of Professor Andrés Peters"
  image_circular: false
  more_info: >
    <div class="contact-info" style="font-family: 'Roboto', sans-serif; color: #666;">
      <p class="mb-1" style="font-weight: 300; line-height: 1.2;">Faculty of Engineering and Sciences</p>
      <p class="mb-1" style="font-weight: 300; line-height: 1.2;">Universidad Adolfo Ibáñez</p>
      <p class="mb-1" style="font-weight: 300; line-height: 1.2;">Av. Diag. Las Torres 2640, Of. 309-D</p>
      <p class="mb-1" style="font-weight: 300; line-height: 1.2;">Peñalolén, Santiago, Chile</p>
    </div>

news: true
selected_papers: true
social: true

serve_og_meta: true
serve_schema_org: true
schema_markup: >
  {
    "@context": "http://schema.org",
    "@type": "Person",
    "name": "Andrés Peters",
    "alternateName": ["Andres Peters", "Andres A. Peters", "A. Peters", "Peters, Andres"],
    "givenName": "Andrés",
    "familyName": "Peters",
    "jobTitle": ["Associate Professor"],
    "worksFor": {
      "@type": "Organization",
      "name": "Universidad Adolfo Ibáñez",
      "alternateName": ["UAI",  "Universidad Adolfo Ibanez"],
      "url": "https://www.uai.cl",
      "department": "Faculty of Engineering and Sciences"
    },
    "url": "https://sapetor.github.io",
    "sameAs": [
      "https://scholar.google.com/citations?user=MrFi22oAAAAJ",
      "https://orcid.org/0000-0003-3282-770X",
      "https://www.linkedin.com/in/andrés-peters-4a57a541",
      "https://github.com/Sapetor"
    ],
    "workLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Santiago",
        "addressRegion": "Peñalolén",
        "addressCountry": "Chile",
        "streetAddress": "Diagonal Las Torres 2640, Of. 309-D"
      }
    },
    "knowsAbout": [
      "Control Systems Theory",
      "Multi-agent Systems",
      "Formation Control",
      "Vehicle Platooning",
      "String Stability",
      "Networked Control Systems",
      "Robotics",
      "Automation",
      "Embedded Systems",
      "Arduino",
      "ESP32",
      "Quanser",
      "Emergent Behavior",
      "Cucker-Smale",
      "Fundamental Limits"
    ],
    "alumniOf": [
      {
        "@type": "CollegeOrUniversity",
        "name": "National University of Ireland, Maynooth",
        "url": "https://www.maynoothuniversity.ie"
      },
      {
        "@type": "CollegeOrUniversity",
        "name": "Universidad Técnica Federico Santa María",
        "url": "https://www.usm.cl"
      }
    ],
    "award": [
      "ANID/FONDECYT Regular 1251406: Characterizing the Effects of Lossy Links in Cooperative Control and Parameter Estimation of Vehicular Platoons (2025-2029)",
      "ANID/FONDECYT Iniciación 11221365: Decentralized Formation Control of Multi-Agent Systems with Applications to Platooning Under Unreliable Communication (2022-2025)",
      "ANID/FONDECYT Postdoctorado 3160738: Theoretical Aspects of Formation Control of Vehicular Platoons (2015-2018)"
    ],
    "teaches": [
      "Modeling and Control of Multi-agent Systems",
      "Fundamentals of Electrical Engineering",
      "Control Theory",
      "Robotics"
    ]
  }
---

<div class="d-none" aria-hidden="true">
  Also known as: Andres Peters, Andres A Peters, Peters Andres
  Professor at Universidad Adolfo Ibáñez (UAI), Universidad Adolfo Ibanez
  Control Systems and Robotics Researcher in Chile
  Research: vehicle platoons, string stability, formation control
  Location: Santiago, Chile
</div>

<section class="research-themes" markdown="0">
  <h2>Research</h2>
  <div class="theme-grid">
    <div class="theme">
      <h3>String stability of vehicle platoons</h3>
      <p>Conditions under which a disturbance at the head of a vehicle string is attenuated, not amplified, as it travels backwards, for different spacing policies and interconnection topologies.</p>
      <ul class="theme-papers">
        <li><a href="https://doi.org/10.1016/j.automatica.2013.09.034">Leader tracking in homogeneous vehicle platoons with broadcast delays</a>, Automatica 2014</li>
        <li><a href="https://doi.org/10.1016/j.ejcon.2015.12.002">Cyclic interconnection for formation control of 1-D vehicle strings</a>, European Journal of Control 2016</li>
      </ul>
    </div>
    <div class="theme">
      <h3>Platooning over unreliable communication</h3>
      <p>Stability and performance of cooperative platoons when vehicle-to-vehicle links lose packets, add noise, or deliver data with random delays, analysed in mean square and in expectation.</p>
      <ul class="theme-papers">
        <li><a href="https://doi.org/10.1016/j.automatica.2022.110710">Mean square stability conditions for platoons with lossy inter-vehicle communication channels</a>, Automatica 2023</li>
        <li><a href="https://doi.org/10.1016/j.automatica.2024.111923">On stochastic string stability with applications to platooning over additive noise channels</a>, Automatica 2025</li>
      </ul>
    </div>
    <div class="theme">
      <h3>Performance limits in optimal control</h3>
      <p>Closed-form bounds on the best achievable H<sub>&infin;</sub> performance under structural and parametric constraints, such as pole location or non-minimum phase zeros, and limits on the time headway that admits string stability.</p>
      <ul class="theme-papers">
        <li><a href="https://doi.org/10.1109/TAC.2020.2982135">An algebraic formula for performance bounds of a weighted H<sub>&infin;</sub> optimal control problem</a>, IEEE TAC 2021</li>
        <li><a href="https://doi.org/10.1016/j.ifacol.2025.10.026">Fundamental limit on time headway for string stability of vehicular platooning</a>, IFAC-PapersOnLine 2025</li>
      </ul>
    </div>
    <div class="theme">
      <h3>Decentralized multi-agent models</h3>
      <p>Simple local interaction rules, such as Cucker&ndash;Smale type flocking, that produce collision-free formations without a central coordinator.</p>
      <ul class="theme-papers">
        <li><a href="https://doi.org/10.1137/19M1241799">A collisionless singular Cucker&ndash;Smale model with decentralized formation control</a>, SIAM J. Applied Dynamical Systems 2019</li>
        <li><a href="https://doi.org/10.3934/nhm.2025036">Collisionless and decentralized formation control for strings</a>, Networks and Heterogeneous Media 2025</li>
      </ul>
    </div>
    <div class="theme">
      <h3>Experimental platforms</h3>
      <p>Low-cost, open-source hardware for testing platooning results and for teaching control: the PL-TOON train platoon and the RUPU line-following robots.</p>
      <ul class="theme-papers">
        <li><a href="https://doi.org/10.3390/s21062072">PL-TOON: a low-cost experimental platform for teaching and research on decentralized cooperative control</a>, Sensors 2021</li>
        <li><a href="https://doi.org/10.1109/chilecon60335.2023.10418641">RUPU: an experimental platform to study line-following platooning problems</a>, IEEE CHILECON 2023</li>
      </ul>
    </div>
  </div>
</section>

## Research grants (as PI)

- **ANID/FONDECYT Regular 1251406 (2025-2029)**: "Characterizing the Effects of Lossy Links in Cooperative Control and Parameter Estimation of Vehicular Platoons"
- **ANID/FONDECYT Iniciación 11221365 (2022-2025)**: "Decentralized Formation Control of Multi-Agent Systems with Applications to Platooning Under Unreliable Communication"
- **ANID/FONDECYT Postdoctorado 3160738 (2015-2018)**: "Theoretical Aspects of Formation Control of Vehicular Platoons"

## Prospective students

I supervise undergraduate and graduate projects in control theory, multi-agent systems, string stability, robotics and automation, experimental validation of control algorithms, and data-driven methods in control. I am also an embedded systems enthusiast, and some projects use them in teaching or industrial applications.

If you are interested in the UAI postgraduate programs, the [MCI (Magíster en Ciencias de la Ingeniería)](https://www.uai.cl/postgrados/master-of-science/magister-en-ciencias-de-la-ingenieria) or the [DDS (Doctorado en Data Science)](https://www.uai.cl/postgrados/doctorados/doctorado-en-data-science), write to andres (dot) peters (at) uai (dot) cl.
