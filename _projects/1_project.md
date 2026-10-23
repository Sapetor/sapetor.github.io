---
layout: page
title: PL-TOON Platform
description: A Low-Cost Experimental Platform for Vehicle Formation Control
img: assets/img/pl-toon/platform.png
importance: 1
category: work
---

PL-TOON (Programmable Low-cost Train platOON) is an experimental platform for research and teaching in vehicle formation control and platooning. It has been used in courses at UTFSM, UTEM, and UAI since 2020.

<div class="row justify-content-sm-center">
    <div class="col-sm-8 mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/pl-toon/platform.png" title="PL-TOON Platform" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Hardware

- Model trains driven by 9 V DC motors on a 3D-printed chassis
- One WiFi-capable microcontroller (ESP32) per train, with sensors, battery, and drive circuitry
- Each train measures its own velocity and the distance to its predecessor

## Software and Communication

- Local PID control loops on each microcontroller
- Decentralized communication between trains over MQTT
- Wireless supervision, data acquisition, and on-the-fly parameter configuration
- A phone-based laboratory mode in which each train hosts its own web dashboard, so a lab session needs no laptop

## Research and Teaching Use

- Experimental validation of string stability and formation control results for one-dimensional platoons
- Remote and in-person control laboratories for undergraduate courses

## Resources

The code is open source: [github.com/pl-toon/pl-toon-codes](https://github.com/pl-toon/pl-toon-codes).

For more information, contact [andres.peters@uai.cl](mailto:andres.peters@uai.cl).
