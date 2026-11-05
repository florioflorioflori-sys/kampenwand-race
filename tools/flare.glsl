      // Sonne: Gegenlicht wie mit einer echten Kamera – weiche Verdeckung, Strahlenkranz,
      // anamorpher Streifen, Halo-Ring, Kette farbiger Blendenreflexe, Staub auf der Linse
      if (uSun.z > 0.001) {
        float vis = 0.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996, rr = 0.004 + 0.011 * sqrt(float(i) / 12.0);
          vis += step(0.99999, texture2D(tDepth, uSun.xy + vec2(cos(a) / uAspect, sin(a)) * rr).x);
        }
        vis = vis / 12.0 * uSun.z;
        if (vis > 0.001) {
          vec2 sp = uSun.xy, asp = vec2(uAspect, 1.0);
          vec2 dv = (vUv - sp) * asp; float dl = length(dv);
          float an = atan(dv.y, dv.x);
          vec3 sunC = vec3(1.0, 0.86, 0.62);
          // Kern und weiches Glühen
          vec3 f = sunC * (0.55 * exp(-dl * 14.0) + 0.16 * exp(-dl * 3.2));
          // Strahlenkranz (Blendenlamellen): 7 Spitzen, langsam funkelnd
          float star = pow(abs(cos(an * 3.5 + 0.3)), 60.0) + pow(abs(cos(an * 3.5 + 1.87)), 120.0) * 0.6;
          f += sunC * star * 0.32 * exp(-dl * 5.5) * (0.85 + 0.15 * sin(uTime * 3.0 + an * 9.0));
          // anamorpher Streifen, leicht bläulich
          f += vec3(0.55, 0.7, 1.0) * 0.16 * exp(-abs(dv.y) * 240.0) * exp(-abs(dv.x) * 2.2);
          // Halo-Ring mit Farbsaum
          float hr = dl - 0.33;
          f += vec3(1.0, 0.45, 0.25) * 0.035 * exp(-pow((hr + 0.008) / 0.012, 2.0)) + vec3(0.3, 0.55, 1.0) * 0.035 * exp(-pow((hr - 0.008) / 0.012, 2.0));
          // Geisterbilder entlang der Achse durch die Bildmitte
          vec2 axis = vec2(0.5) - sp;
          for (int g = 0; g < 8; g++) {
            float fg = float(g);
            float t = g == 0 ? 0.32 : g == 1 ? 0.55 : g == 2 ? 0.72 : g == 3 ? 0.95 : g == 4 ? 1.18 : g == 5 ? 1.42 : g == 6 ? 1.7 : 2.05;
            float rad = g == 0 ? 0.018 : g == 1 ? 0.05 : g == 2 ? 0.026 : g == 3 ? 0.09 : g == 4 ? 0.035 : g == 5 ? 0.06 : g == 6 ? 0.14 : 0.05;
            vec3 gc = g == 0 ? vec3(0.9, 0.7, 0.4) : g == 1 ? vec3(0.4, 0.85, 0.55) : g == 2 ? vec3(0.95, 0.45, 0.3) : g == 3 ? vec3(0.45, 0.55, 1.0)
                    : g == 4 ? vec3(1.0, 0.8, 0.5) : g == 5 ? vec3(0.6, 0.45, 0.95) : g == 6 ? vec3(0.35, 0.7, 0.75) : vec3(1.0, 0.55, 0.35);
            vec2 gp = (vUv - (sp + axis * t)) * asp;
            // Sechseck wie die Blende
            vec2 q = abs(gp); float hx = max(q.x * 0.866 + q.y * 0.5, q.y);
            float shape = (g == 3 || g == 6) ? length(gp) : hx;
            float body = smoothstep(rad, rad * 0.82, shape);
            float rim = exp(-pow((shape - rad * 0.9) / (rad * 0.08), 2.0));
            // Farbsaum: Rot außen, Blau innen
            vec3 fr = gc * (body * 0.5 + rim * 0.6) + vec3(0.9, 0.3, 0.2) * exp(-pow((shape - rad) / (rad * 0.05), 2.0)) * 0.25;
            f += fr * (0.075 - fg * 0.004);
          }
          // Staub und Schlieren auf der Linse, nur nahe der Sonne sichtbar
          vec2 dg = vUv * vec2(uAspect, 1.0) * 9.0;
          vec2 di = floor(dg); vec2 df = fract(dg) - 0.5 - (vec2(hash(di), hash(di + 3.1)) - 0.5) * 0.6;
          float dust = smoothstep(0.16, 0.02, length(df)) * step(0.72, hash(di + 7.7));
          float smear = smoothstep(0.55, 1.0, sin(vUv.x * 7.0 + sin(vUv.y * 5.0) * 1.3) * sin(vUv.y * 4.0 - vUv.x * 2.0));
          f += sunC * (dust * 0.07 + smear * 0.04) * exp(-dl * 4.0);
          // Schleierlicht: der ganze Kontrast sinkt leicht
          col = mix(col, col * 0.92 + sunC * 0.06, vis * 0.6);
          col += f * vis;
        }
      }
