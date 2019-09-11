---
description: Inhabilita las cookies en Google Analytics y cumple así la normativa de la GDPR/RGPD sin necesidad de acciones adicionales
lang: es_ES
permalink: marketing-digital/como-evitar-cookies-google-analytics-cumplir-ley-proteccion-datos
redirect_to: https://emirodgar.com/

---

# Cómo evitar las cookies de Google Analytics y cumplir con la ley de protección de datos

Me gusta la sencillez; odio los popups, avisos y formularios. Todo lo que atente contra una experiencia ágil y cómoda en una web debería ser eliminado.

Con estas premisas en mente nunca he sido amigo de la **política de cookies** donde tenemos que incomodar al usuario para preguntarle si acepta todas y cada una de ellas antes de poder usarlas. Por ello, desde un primer momento, decidí no hacer uso de ninguna.

Google Analytics -en su última versión- [utiliza al menos tres cookies](https://developers.google.com/analytics/devguides/collection/analyticsjs/cookie-usage?hl=es-419) por lo que por defecto nos veríamos obligados a tener que avisar al usuario.

A mayores, dichas cookies utilizan información para identificar -de forma inequívoca- a cada usuario por lo que se considera de carácter personal. Los campos que realizan este trabajo son el [ClientID](https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference#clientId) y el [UserID](https://support.google.com/analytics/answer/3123662?hl=es). Por todo ello, la solución es simple: **evitar almacenar dicha información y no generar cookie alguna**.

Lógicamente, yo estoy dispuesto a **sacrifir consistencia en mi analítica** (no seré capaz de conocer usuarios recurrentes ni atribución correcta en la conversión) dado que principalmente mis páginas son informativas y las métricas que más me interesan son visitas, canales y tiempo en el sitio. En otro caso, sin el uso de cookies, perderemos consistencia y capacidad de análisis.

## Evitar que Google Analytics genere cookies

Para ello bastará con definir el [campo storage a none](https://developers.google.com/analytics/devguides/collection/analyticsjs/cookies-user-id#disabling_cookies) de la siguiente manera:

```
ga('create', 'UA-XXXXX-Y', {
  'storage': 'none'
});
```

En la documentación oficial, Google aboga por suplir la carencia de sus cookies almacenando la información del **ClientID** a través de la [función LocalStore de HTML5](https://developer.mozilla.org/es/docs/Web/API/Window/localStorage), pero cuidado, almacenar ahí la información de carácter personal también está sujeto a la ley de protección de datos por lo que igualmente tendremos que avisar al usuario antes de hacerlo.

Por último, y para evitar cualquier problema, recomiendo hacer uso de la función [anonymizeIp](https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference?hl=en#anonymizeIp) evitando así guardar cualquier dato de carácter personal en Google Analytics.

```
ga('create', 'UA-XXXXX-Y', {
  'storage': 'none',
  'anonymizeIp': true
});
```

Según qué casos, también tendremos que deshabilitar la cookie asociada a las campañas: [StoreGAC](https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference?hl=en#storeGac).
<!--stackedit_data:
eyJoaXN0b3J5IjpbLTExMDgxNjM2NDRdfQ==
-->
