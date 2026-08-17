// A marca da IECC em SVG, para usar dentro das telas.
//
// O traço usa `currentColor`, então a cor vem do CSS de quem coloca a marca
// na tela. A versão completa (com o texto em arco) fica embutida no
// index.html, na tela de abertura; os arquivos em icons/ servem para gerar
// os ícones do celular.

export const MARCA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="44 78 152 200" role="img" aria-label="Igreja Aberta">
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M56 250 V150 A64 64 0 0 1 184 150 V250" />
    <circle cx="120" cy="150" r="18" />
    <g stroke-width="2.8">
      <path d="M94 146 L80 144" />
      <path d="M97 138 L83 131" />
      <path d="M102 132 L91 121" />
      <path d="M108 127 L101 113" />
      <path d="M116 124 L114 110" />
      <path d="M124 124 L126 110" />
      <path d="M132 127 L139 113" />
      <path d="M138 132 L149 121" />
      <path d="M143 138 L157 131" />
      <path d="M146 146 L160 144" />
    </g>
    <path d="M120 122 V250" />
    <path d="M86 158 H154" />
    <path d="M56 236 C 74 196 104 192 122 236" />
    <path d="M56 250 C 80 214 108 212 132 250" />
    <path d="M152 250 C 136 224 138 190 154 172 C 170 190 172 224 156 250" />
    <path d="M154 250 V186" />
    <path d="M52 258 C 78 248 104 250 120 260 C 136 250 162 248 188 258" />
    <path d="M52 258 V268 C 78 258 104 260 120 270 C 136 260 162 258 188 268 V258" />
    <path d="M120 260 V270" />
  </g>
</svg>`;
