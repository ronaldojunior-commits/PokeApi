// ==========================================
// CONFIGURAÇÕES E ELEMENTOS
// ==========================================

const API = "https://pokeapi.co/api/v2";

const QUANTIDADE_POR_PAGINA = 12;
const TOTAL_POKEMON = 1025;

const elementos = {
    grade: document.getElementById("grade-pokemon"),
    pesquisa: document.getElementById("campo-pesquisa"),
    formulario: document.getElementById("form-pesquisa"),
    mensagem: document.getElementById("mensagem-pesquisa"),
    aleatorio: document.getElementById("botao-aleatorio"),
    anterior: document.getElementById("pagina-anterior"),
    proxima: document.getElementById("pagina-proxima"),
    indicador: document.getElementById("indicador-pagina"),
    total: document.getElementById("total-pokemon"),
    detalhes: document.getElementById("painel-detalhes"),
    favoritos: document.getElementById("lista-favoritos"),
    quantidadeFavoritos: document.getElementById("quantidade-favoritos"),
    comparacao: document.getElementById("painel-comparacao"),
    limparComparacao: document.getElementById("limpar-comparacao"),
    notificacao: document.getElementById("notificacao")
};

const nomesTipos = {
    normal: "Normal",
    fire: "Fogo",
    water: "Água",
    grass: "Planta",
    electric: "Elétrico",
    ice: "Gelo",
    fighting: "Lutador",
    poison: "Veneno",
    ground: "Terra",
    flying: "Voador",
    psychic: "Psíquico",
    bug: "Inseto",
    rock: "Pedra",
    ghost: "Fantasma",
    dragon: "Dragão",
    dark: "Sombrio",
    steel: "Aço",
    fairy: "Fada"
};

const nomesAtributos = {
    hp: "HP",
    attack: "Ataque",
    defense: "Defesa",
    "special-attack": "Ataque especial",
    "special-defense": "Defesa especial",
    speed: "Velocidade"
};

const atributosFutebol = [
    ["hp", "HP"],
    ["attack", "Ataque"],
    ["defense", "Defesa"],
    ["speed", "Velocidade"],
    ["special", "Poder especial"]
];

// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================

const cache = new Map();

let paginaAtual = 1;
let filtroAtual = "todos";
let listaCatalogo = [];
let pokemonSelecionado = null;
let favoritos = carregarFavoritos();
let comparacao = [];

let listaTimes = [];
let timeAzul = null;
let timeRoxo = null;

let partidaAtiva = false;
let rodada = 0;
let golsAzul = 0;
let golsRoxo = 0;

let temporizadorPartida = null;
let quadroAnimacao = null;
let identificadorAnimacao = 0;

// ==========================================
// API GATEWAY E CACHE
// ==========================================

async function consultarAPI(caminho) {
    const url = caminho.startsWith("http")
        ? caminho
        : `${API}/${caminho.replace(/^\/+/, "")}`;

    if (cache.has(url)) {
        return cache.get(url);
    }

    try {
        const resposta = await fetch(url);

        if (!resposta.ok) {
            if (resposta.status === 404) {
                throw new Error("Pokémon não encontrado.");
            }

            throw new Error(`Erro na consulta: ${resposta.status}`);
        }

        const dados = await resposta.json();

        cache.set(url, dados);

        return dados;

    } catch (erro) {
        if (erro instanceof TypeError) {
            throw new Error("Não foi possível conectar à PokéAPI. Verifique sua internet.");
        }

        throw erro;
    }
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function escaparHTML(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

function nomeBonito(nome) {
    return nome
        .split("-")
        .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(" ");
}

function numeroFormatado(numero) {
    return `#${String(numero).padStart(3, "0")}`;
}

function imagemPokemon(pokemon) {
    return pokemon.sprites?.other?.["official-artwork"]?.front_default
        || pokemon.sprites?.front_default
        || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
}

function mostrarNotificacao(mensagem) {
    elementos.notificacao.textContent = mensagem;
    elementos.notificacao.classList.add("visivel");

    clearTimeout(mostrarNotificacao.timer);

    mostrarNotificacao.timer = setTimeout(() => {
        elementos.notificacao.classList.remove("visivel");
    }, 2600);
}

function mostrarErro(mensagem) {
    elementos.mensagem.textContent = mensagem;
}

function nomeTipo(pokemon) {
    return pokemon.types
        .map(item => nomesTipos[item.type.name] || item.type.name)
        .join(" / ");
}

function obterAtributos(pokemon) {
    const valores = {};

    pokemon.stats.forEach(item => {
        valores[item.stat.name] = item.base_stat;
    });

    return {
        hp: valores.hp || 0,
        attack: valores.attack || 0,
        defense: valores.defense || 0,
        speed: valores.speed || 0,
        special: Math.round(
            ((valores["special-attack"] || 0) +
            (valores["special-defense"] || 0)) / 2
        )
    };
}

function traduzirHabilidade(nome) {
    return nomeBonito(nome.replaceAll("-", " "));
}

function converterPeso(valor) {
    return (valor / 10).toFixed(1);
}

function converterAltura(valor) {
    return (valor / 10).toFixed(1);
}

// ==========================================
// CATÁLOGO E PAGINAÇÃO
// ==========================================

async function carregarListaCatalogo() {
    elementos.grade.innerHTML = '<div class="estado-vazio">Carregando Pokédex...</div>';

    try {
        const dados = await consultarAPI(
            `pokemon?limit=${TOTAL_POKEMON}&offset=0`
        );

        listaCatalogo = dados.results.map(item => ({
            nome: item.name,
            url: item.url,
            id: Number(item.url.split("/").filter(Boolean).pop())
        }));

        elementos.total.textContent = `${dados.count} Pokémon disponíveis`;

        await preencherSeletoresTimes();

        await carregarPagina(1);

    } catch (erro) {
        elementos.grade.innerHTML = `
            <div class="estado-vazio">
                ${escaparHTML(erro.message)}
            </div>
        `;

        mostrarErro(erro.message);
    }
}

async function obterListaFiltrada() {
    if (filtroAtual === "todos") {
        return listaCatalogo;
    }

    const dados = await consultarAPI(`type/${filtroAtual}`);

    const nomes = new Set(
        dados.pokemon.map(item => item.pokemon.name)
    );

    return listaCatalogo.filter(item => nomes.has(item.nome));
}

async function carregarPagina(numero) {
    paginaAtual = numero;

    elementos.grade.innerHTML = '<div class="estado-vazio">Buscando Pokémon...</div>';

    try {
        const lista = await obterListaFiltrada();

        const inicio = (paginaAtual - 1) * QUANTIDADE_POR_PAGINA;

        const pokemonDaPagina = lista.slice(
            inicio,
            inicio + QUANTIDADE_POR_PAGINA
        );

        const totalPaginas = Math.max(
            1,
            Math.ceil(lista.length / QUANTIDADE_POR_PAGINA)
        );

        if (pokemonDaPagina.length === 0) {
            elementos.grade.innerHTML = `
                <div class="estado-vazio">Nenhum Pokémon encontrado.</div>
            `;

            atualizarPaginacao(totalPaginas);
            return;
        }

        const dados = await Promise.all(
            pokemonDaPagina.map(item => consultarAPI(item.url))
        );

        elementos.grade.innerHTML = "";

        dados.forEach(pokemon => {
            elementos.grade.appendChild(criarCartaoPokemon(pokemon));
        });

        atualizarPaginacao(totalPaginas);

        elementos.mensagem.textContent =
            `${lista.length} Pokémon encontrados neste catálogo.`;

    } catch (erro) {
        elementos.grade.innerHTML = `
            <div class="estado-vazio">${escaparHTML(erro.message)}</div>
        `;
    }
}

function atualizarPaginacao(totalPaginas) {
    elementos.indicador.textContent =
        `Página ${paginaAtual} de ${totalPaginas}`;

    elementos.anterior.disabled = paginaAtual <= 1;

    elementos.proxima.disabled = paginaAtual >= totalPaginas;
}

function criarCartaoPokemon(pokemon) {
    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = "pokemon-card";

    if (pokemonSelecionado?.id === pokemon.id) {
        botao.classList.add("selecionado");
    }

    botao.innerHTML = `
        <img
            src="${imagemPokemon(pokemon)}"
            alt="${escaparHTML(nomeBonito(pokemon.name))}"
            loading="lazy"
        >
        <span class="numero-pokemon">${numeroFormatado(pokemon.id)}</span>
        <span class="nome-pokemon">${escaparHTML(nomeBonito(pokemon.name))}</span>
    `;

    botao.addEventListener("click", () => {
        selecionarPokemon(pokemon.id);
    });

    return botao;
}

// ==========================================
// PESQUISA
// ==========================================

async function pesquisarPokemon(valor) {
    const pesquisa = valor.trim().toLowerCase();

    if (!pesquisa) {
        mostrarErro("Digite o nome ou número de um Pokémon.");
        return;
    }

    mostrarErro("Pesquisando Pokémon...");

    try {
        const pokemon = await consultarAPI(`pokemon/${encodeURIComponent(pesquisa)}`);

        await selecionarPokemon(pokemon.id);

        mostrarErro(`${nomeBonito(pokemon.name)} encontrado!`);

        elementos.grade.querySelectorAll(".pokemon-card").forEach(cartao => {
            cartao.classList.remove("selecionado");
        });

        mostrarNotificacao("Pokémon encontrado!");

    } catch (erro) {
        mostrarErro(erro.message);
        mostrarNotificacao(erro.message);
    }
}

async function pesquisarAleatorio() {
    const numero = Math.floor(Math.random() * TOTAL_POKEMON) + 1;

    elementos.pesquisa.value = numero;

    await pesquisarPokemon(String(numero));
}

// ==========================================
// FICHA DO POKÉMON
// ==========================================

async function selecionarPokemon(id) {
    elementos.detalhes.innerHTML = `
        <h3>Ficha do Pokémon</h3>
        <p class="texto-auxiliar">Carregando informações...</p>
    `;

    try {
        const pokemon = await consultarAPI(`pokemon/${id}`);

        pokemonSelecionado = pokemon;

        await mostrarDetalhes(pokemon);

        atualizarCartoesSelecionados();

    } catch (erro) {
        elementos.detalhes.innerHTML = `
            <h3>Ficha do Pokémon</h3>
            <p class="texto-auxiliar">${escaparHTML(erro.message)}</p>
        `;
    }
}

function atualizarCartoesSelecionados() {
    elementos.grade.querySelectorAll(".pokemon-card").forEach(cartao => {
        const numero = Number(
            cartao.querySelector(".numero-pokemon").textContent.replace("#", "")
        );

        cartao.classList.toggle(
            "selecionado",
            numero === pokemonSelecionado?.id
        );
    });
}

async function mostrarDetalhes(pokemon) {
    let especie = null;
    let descricao = "Descrição não disponível.";
    let evolucao = [];

    try {
        especie = await consultarAPI(`pokemon-species/${pokemon.id}`);

        const texto = especie.flavor_text_entries.find(
            item => item.language.name === "pt"
        ) || especie.flavor_text_entries.find(
            item => item.language.name === "en"
        );

        if (texto) {
            descricao = texto.flavor_text
                .replace(/[\n\f]/g, " ");
        }

        if (especie.evolution_chain?.url) {
            const cadeia = await consultarAPI(especie.evolution_chain.url);

            evolucao = extrairEvolucoes(cadeia.chain);
        }

    } catch (erro) {
        console.warn("Alguns dados da espécie não puderam ser carregados:", erro);
    }

    const favorito = favoritos.some(item => item.id === pokemon.id);

    const habilidades = pokemon.abilities.map(item => `
        <span class="habilidade">
            ${escaparHTML(traduzirHabilidade(item.ability.name))}
            ${item.is_hidden ? "(Oculta)" : ""}
        </span>
    `).join("");

    const estatisticas = pokemon.stats.map(item => {
        const nome = nomesAtributos[item.stat.name] || item.stat.name;
        const valor = item.base_stat;
        const largura = Math.min(100, valor / 2.55);

        return `
            <div class="barra-stat">
                <div class="stat-cabecalho">
                    <span>${escaparHTML(nome)}</span>
                    <span>${valor}</span>
                </div>
                <div class="stat-fundo">
                    <div class="stat-valor" style="width:${largura}%"></div>
                </div>
            </div>
        `;
    }).join("");

    const tipos = pokemon.types.map(item => `
        <span class="tipo-etiqueta">
            ${escaparHTML(nomesTipos[item.type.name] || item.type.name)}
        </span>
    `).join("");

    const evolucoesHTML = evolucao.length
        ? evolucao.map(nome => `
            <button
                type="button"
                class="botao botao-secundario"
                data-evolucao="${escaparHTML(nome)}"
            >
                ${escaparHTML(nomeBonito(nome))}
            </button>
        `).join("")
        : '<p class="texto-auxiliar">Evolução não disponível.</p>';

    elementos.detalhes.innerHTML = `
        <h3>Ficha do Pokémon</h3>

        <img
            class="detalhes-imagem"
            src="${imagemPokemon(pokemon)}"
            alt="${escaparHTML(pokemon.name)}"
        >

        <p class="detalhes-numero">${numeroFormatado(pokemon.id)}</p>

        <h2 class="detalhes-nome">
            ${escaparHTML(nomeBonito(pokemon.name))}
        </h2>

        <div class="etiquetas-tipo">${tipos}</div>

        <p class="texto-auxiliar">${escaparHTML(descricao)}</p>

        <div class="acoes-detalhe">
            <button
                id="botao-favorito"
                class="botao ${favorito ? "botao-principal" : "botao-secundario"}"
                type="button"
            >
                ${favorito ? "★ Favoritado" : "☆ Favoritar"}
            </button>

            <button
                id="botao-comparar"
                class="botao botao-secundario"
                type="button"
            >
                + Comparar
            </button>
        </div>

        <div class="detalhe-bloco">
            <h4>Informações físicas</h4>

            <div class="detalhe-linha">
                <span>Altura</span>
                <strong>${converterAltura(pokemon.height)} m</strong>
            </div>

            <div class="detalhe-linha">
                <span>Peso</span>
                <strong>${converterPeso(pokemon.weight)} kg</strong>
            </div>

            <div class="detalhe-linha">
                <span>Experiência base</span>
                <strong>${pokemon.base_experience ?? "Não disponível"}</strong>
            </div>

            <div class="detalhe-linha">
                <span>Categoria</span>
                <strong>${especie?.genera?.find(item => item.language.name === "pt")?.genus || "Pokémon"}</strong>
            </div>
        </div>

        <div class="detalhe-bloco">
            <h4>Habilidades</h4>
            <div class="lista-habilidades">${habilidades}</div>
        </div>

        <div class="detalhe-bloco">
            <h4>Estatísticas</h4>
            ${estatisticas}
        </div>

        <div class="detalhe-bloco">
            <h4>Linha de evolução</h4>
            <div class="lista-habilidades">${evolucoesHTML}</div>
        </div>
    `;

    document.getElementById("botao-favorito")
        .addEventListener("click", () => alternarFavorito(pokemon));

    document.getElementById("botao-comparar")
        .addEventListener("click", () => adicionarComparacao(pokemon));

    elementos.detalhes.querySelectorAll("[data-evolucao]").forEach(botao => {
        botao.addEventListener("click", () => {
            pesquisarPokemon(botao.dataset.evolucao);
        });
    });
}

function extrairEvolucoes(no, resultado = []) {
    resultado.push(no.species.name);

    no.evolves_to.forEach(proximo => {
        extrairEvolucoes(proximo, resultado);
    });

    return resultado;
}

// ==========================================
// FAVORITOS
// ==========================================

function carregarFavoritos() {
    try {
        return JSON.parse(localStorage.getItem("pokemonFavoritos")) || [];
    } catch {
        return [];
    }
}

function salvarFavoritos() {
    localStorage.setItem("pokemonFavoritos", JSON.stringify(favoritos));
    atualizarFavoritos();
}

function alternarFavorito(pokemon) {
    const existe = favoritos.some(item => item.id === pokemon.id);

    if (existe) {
        favoritos = favoritos.filter(item => item.id !== pokemon.id);
        mostrarNotificacao("Pokémon removido dos favoritos.");
    } else {
        favoritos.push({
            id: pokemon.id,
            name: pokemon.name,
            image: imagemPokemon(pokemon)
        });

        mostrarNotificacao("Pokémon adicionado aos favoritos!");
    }

    salvarFavoritos();

    if (pokemonSelecionado?.id === pokemon.id) {
        mostrarDetalhes(pokemon);
    }
}

function atualizarFavoritos() {
    elementos.quantidadeFavoritos.textContent = favoritos.length;

    if (favoritos.length === 0) {
        elementos.favoritos.innerHTML = `
            <p class="texto-auxiliar">Nenhum favorito salvo ainda.</p>
        `;
        return;
    }

    elementos.favoritos.innerHTML = favoritos.map(item => `
        <div class="favorito-item">
            <img src="${item.image}" alt="${escaparHTML(item.name)}">

            <button type="button" data-favorito="${item.id}">
                ${escaparHTML(nomeBonito(item.name))}
            </button>

            <button
                type="button"
                class="favorito-remover"
                data-remover-favorito="${item.id}"
                aria-label="Remover favorito"
            >
                ✕
            </button>
        </div>
    `).join("");

    elementos.favoritos.querySelectorAll("[data-favorito]").forEach(botao => {
        botao.addEventListener("click", () => {
            selecionarPokemon(Number(botao.dataset.favorito));
        });
    });

    elementos.favoritos.querySelectorAll("[data-remover-favorito]").forEach(botao => {
        botao.addEventListener("click", () => {
            const id = Number(botao.dataset.removerFavorito);

            favoritos = favoritos.filter(item => item.id !== id);

            salvarFavoritos();

            if (pokemonSelecionado?.id === id) {
                mostrarDetalhes(pokemonSelecionado);
            }

            mostrarNotificacao("Favorito removido.");
        });
    });
}

// ==========================================
// COMPARAÇÃO DE POKÉMON
// ==========================================

function adicionarComparacao(pokemon) {
    if (comparacao.some(item => item.id === pokemon.id)) {
        mostrarNotificacao("Este Pokémon já está na comparação.");
        return;
    }

    if (comparacao.length >= 2) {
        mostrarNotificacao("A comparação permite somente dois Pokémon.");
        return;
    }

    comparacao.push(pokemon);

    atualizarComparacao();

    mostrarNotificacao("Pokémon adicionado à comparação.");
}

function atualizarComparacao() {
    if (comparacao.length === 0) {
        elementos.comparacao.innerHTML = `
            <p class="texto-auxiliar">Selecione dois Pokémon para comparar.</p>
        `;
        return;
    }

    let html = comparacao.map(pokemon => `
        <div class="comparacao-item">
            <img src="${imagemPokemon(pokemon)}" alt="">
            <strong>${escaparHTML(nomeBonito(pokemon.name))}</strong>
        </div>
    `).join("");

    if (comparacao.length === 2) {
        const a = obterAtributos(comparacao[0]);
        const b = obterAtributos(comparacao[1]);

        html += `
            <div class="tabela-responsiva">
                <table class="comparacao-tabela">
                    <thead>
                        <tr>
                            <th>Atributo</th>
                            <th>${escaparHTML(nomeBonito(comparacao[0].name))}</th>
                            <th>${escaparHTML(nomeBonito(comparacao[1].name))}</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        Object.entries(nomesAtributos).forEach(([chave, nome]) => {
            const valorA = comparacao[0].stats.find(
                item => item.stat.name === chave
            ).base_stat;

            const valorB = comparacao[1].stats.find(
                item => item.stat.name === chave
            ).base_stat;

            html += `
                <tr>
                    <td>${nome}</td>
                    <td class="${valorA > valorB ? "melhor" : ""}">${valorA}</td>
                    <td class="${valorB > valorA ? "melhor" : ""}">${valorB}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    } else {
        html += `
            <p class="texto-auxiliar">
                Escolha mais um Pokémon para concluir a comparação.
            </p>
        `;
    }

    elementos.comparacao.innerHTML = html;
}

// ==========================================
// FILTROS
// ==========================================

document.getElementById("filtros-tipo").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-tipo]");

    if (!botao) return;

    filtroAtual = botao.dataset.tipo;

    document.querySelectorAll(".filtro").forEach(item => {
        item.classList.remove("ativo");
    });

    botao.classList.add("ativo");

    await carregarPagina(1);
});

// ==========================================
// SELEÇÃO DOS TIMES DE FUTEBOL
// ==========================================

async function preencherSeletoresTimes() {
    const selectAzul = document.getElementById("pokemon-one");
    const selectRoxo = document.getElementById("pokemon-two");

    listaTimes = listaCatalogo.filter(item => item.id <= 151);

    const opcoes = listaTimes.map(item => `
        <option value="${item.id}">
            ${numeroFormatado(item.id)} - ${escaparHTML(nomeBonito(item.nome))}
        </option>
    `).join("");

    selectAzul.innerHTML = opcoes;
    selectRoxo.innerHTML = opcoes;

    selectAzul.value = "25";
    selectRoxo.value = "6";

    await atualizarTimes();
}

async function atualizarTimes() {
    const idAzul = Number(document.getElementById("pokemon-one").value);
    const idRoxo = Number(document.getElementById("pokemon-two").value);

    try {
        [timeAzul, timeRoxo] = await Promise.all([
            consultarAPI(`pokemon/${idAzul}`),
            consultarAPI(`pokemon/${idRoxo}`)
        ]);

        atualizarVisualTimes();
        atualizarTabelaAtributos();
        reiniciarPartida();

    } catch (erro) {
        mostrarNotificacao(erro.message);
    }
}

function atualizarVisualTimes() {
    const times = [
        ["one", timeAzul],
        ["two", timeRoxo]
    ];

    times.forEach(([lado, pokemon]) => {
        const imagem = imagemPokemon(pokemon);
        const nome = nomeBonito(pokemon.name);
        const tipo = nomeTipo(pokemon);

        document.getElementById(`imagem-${lado}`).src = imagem;
        document.getElementById(`imagem-${lado}`).alt = nome;

        document.getElementById(`nome-${lado}`).textContent = nome;
        document.getElementById(`tipo-${lado}`).textContent = tipo;

        document.getElementById(`campo-imagem-${lado}`).src = imagem;
        document.getElementById(`campo-imagem-${lado}`).alt = nome;

        document.getElementById(`campo-nome-${lado}`).textContent = nome;

        document.getElementById(`placar-nome-${lado}`).textContent = nome;
        document.getElementById(`tabela-nome-${lado}`).textContent = nome;
    });
}

function atualizarTabelaAtributos() {
    const a = obterAtributos(timeAzul);
    const b = obterAtributos(timeRoxo);

    const corpo = document.getElementById("tabela-atributos");

    corpo.innerHTML = "";

    atributosFutebol.forEach(([chave, nome]) => {
        const linha = document.createElement("tr");

        const classeA = a[chave] > b[chave] ? "vencedor" : "";
        const classeB = b[chave] > a[chave] ? "vencedor" : "";

        linha.innerHTML = `
            <td>${nome}</td>
            <td class="${classeA}">${a[chave]}</td>
            <td class="${classeB}">${b[chave]}</td>
        `;

        corpo.appendChild(linha);
    });
}

// ==========================================
// MOTOR DE ANIMAÇÃO DO FUTEBOL
// ==========================================

function dimensoesCampo() {
    const campo = document.getElementById("campo");

    return {
        largura: campo.clientWidth,
        altura: campo.clientHeight
    };
}

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function suavizar(valor) {
    return valor * valor * (3 - 2 * valor);
}

function posicionarBola(x, y, rotacao = 0) {
    const { largura, altura } = dimensoesCampo();

    const bola = document.getElementById("bola");

    bola.style.left = `${limitar(x, 18, largura - 18)}px`;
    bola.style.top = `${limitar(y, 18, altura - 18)}px`;

    bola.style.transform =
        `translate(-50%, -50%) rotate(${rotacao}deg)`;
}

function centroJogador(lado) {
    const jogador = document.querySelector(`.jogador-${lado}`);
    const retangulo = jogador.getBoundingClientRect();

    const campo = document.getElementById("campo").getBoundingClientRect();

    return {
        x: retangulo.left + retangulo.width / 2 - campo.left,
        y: retangulo.top + retangulo.height / 2 - campo.top
    };
}

function moverJogador(lado, x, y) {
    const jogador = document.querySelector(`.jogador-${lado}`);

    jogador.style.transform =
        `translate(${x}px, calc(-50% + ${y}px))`;
}

function animar(duracao, atualizar, concluir, token) {
    const inicio = performance.now();

    function quadro(agora) {
        if (token !== identificadorAnimacao) return;

        const progresso = limitar(
            (agora - inicio) / duracao,
            0,
            1
        );

        atualizar(progresso);

        if (progresso < 1) {
            quadroAnimacao = requestAnimationFrame(quadro);
        } else {
            quadroAnimacao = null;
            concluir();
        }
    }

    quadroAnimacao = requestAnimationFrame(quadro);
}

function aguardar(tempo, funcao, token) {
    temporizadorPartida = setTimeout(() => {
        if (token === identificadorAnimacao) {
            funcao();
        }
    }, tempo);
}

function limparAnimacoes() {
    identificadorAnimacao++;

    clearTimeout(temporizadorPartida);
    cancelAnimationFrame(quadroAnimacao);

    quadroAnimacao = null;

    ["one", "two"].forEach(lado => {
        const jogador = document.querySelector(`.jogador-${lado}`);

        jogador.style.transform = "";
        jogador.classList.remove("chutando", "comemorando");
    });

    const { largura, altura } = dimensoesCampo();

    posicionarBola(largura * .5, altura * .68);

    document.getElementById("aviso-gol").className = "aviso-gol";
}

function animarGol(vencedor, concluir) {
    const token = identificadorAnimacao;

    const { largura, altura } = dimensoesCampo();

    const inicio = {
        x: largura * .5,
        y: altura * .68
    };

    const direcao = vencedor === "one" ? 1 : -1;

    const atacante = centroJogador(vencedor);

    const outro = vencedor === "one" ? "two" : "one";

    const defensor = centroJogador(outro);

    const contato = {
        x: inicio.x - direcao * 29,
        y: inicio.y - 8
    };

    const deslocamentoX = limitar(
        contato.x - atacante.x,
        -largura * .42,
        largura * .42
    );

    const deslocamentoY = limitar(
        contato.y - atacante.y,
        -altura * .42,
        altura * .42
    );

    animar(580, progresso => {
        const movimento = suavizar(progresso);

        moverJogador(
            vencedor,
            deslocamentoX * movimento,
            deslocamentoY * movimento
        );

        moverJogador(
            outro,
            (inicio.x - defensor.x) * .12 * movimento,
            (inicio.y - defensor.y) * .23 * movimento
        );

    }, () => {
        aguardar(180, () => {

            document.querySelector(`.jogador-${vencedor}`)
                .classList.add("chutando");

            aguardar(280, () => {

                document.querySelector(`.jogador-${vencedor}`)
                    .classList.remove("chutando");

                const finalX = direcao > 0 ? largura - 20 : 20;
                const finalY = altura * .5;

                animar(930, progresso => {
                    const deslocamento = progresso < .48
                        ? .70 * Math.pow(progresso / .48, 1.48)
                        : .70 + .30 * (
                            1 - Math.pow(
                                1 - (progresso - .48) / .52,
                                1.55
                            )
                        );

                    const x = inicio.x + (finalX - inicio.x) * deslocamento;

                    const arco = -altura * .19 * Math.sin(Math.PI * progresso);

                    const quique = progresso > .68
                        ? -altura * .036 * Math.pow(
                            Math.sin(Math.PI * (progresso - .68) / .32),
                            2
                        )
                        : 0;

                    const y =
                        inicio.y +
                        (finalY - inicio.y) * progresso +
                        arco +
                        quique;

                    posicionarBola(x, y, direcao * 590 * progresso);

                    moverJogador(
                        outro,
                        limitar((x - defensor.x) * .34, -largura * .22, largura * .22),
                        limitar((y - defensor.y) * .44, -altura * .25, altura * .25)
                    );

                }, () => {
                    const aviso = document.getElementById("aviso-gol");

                    aviso.classList.remove("mostrar");

                    void aviso.offsetWidth;

                    aviso.classList.add("mostrar");

                    document.querySelector(`.jogador-${vencedor}`)
                        .classList.add("comemorando");

                    concluir();

                }, token);

            }, token);

        }, token);

    }, token);
}

function animarEmpate(concluir) {
    const token = identificadorAnimacao;

    const { largura, altura } = dimensoesCampo();

    animar(780, progresso => {
        const pulo =
            Math.abs(Math.sin(progresso * Math.PI * 2)) *
            (1 - progresso) *
            altura * .12;

        posicionarBola(
            largura * .5 + Math.sin(progresso * Math.PI) * largura * .035,
            altura * .68 - pulo,
            170 * progresso
        );

        moverJogador("one", largura * .035 * suavizar(progresso), 0);
        moverJogador("two", -largura * .035 * suavizar(progresso), 0);

    }, concluir, token);
}

// ==========================================
// CONTROLE DA PARTIDA
// ==========================================

function atualizarProgresso() {
    document.getElementById("progresso-partida").style.width =
        `${rodada * 20}%`;
}

function reiniciarPartida() {
    clearTimeout(temporizadorPartida);

    partidaAtiva = false;
    rodada = 0;
    golsAzul = 0;
    golsRoxo = 0;

    document.getElementById("placar-one").textContent = "0";
    document.getElementById("placar-two").textContent = "0";

    document.getElementById("status-partida").textContent =
        "Pronto para jogar";

    document.getElementById("comentario-partida").textContent =
        "Escolha seus times e inicie a partida.";

    document.getElementById("resultado-partida").hidden = true;

    document.getElementById("iniciar-partida").disabled = false;

    atualizarProgresso();

    limparAnimacoes();
}

function finalizarPartida() {
    partidaAtiva = false;

    document.getElementById("iniciar-partida").disabled = false;

    const nomeAzul = nomeBonito(timeAzul.name);
    const nomeRoxo = nomeBonito(timeRoxo.name);

    let titulo;
    let mensagem;

    if (golsAzul > golsRoxo) {
        titulo = `🏆 ${nomeAzul} venceu!`;
        mensagem =
            `${nomeAzul} ganhou ${golsAzul} dos cinco critérios, contra ${golsRoxo} de ${nomeRoxo}.`;
    } else if (golsRoxo > golsAzul) {
        titulo = `🏆 ${nomeRoxo} venceu!`;
        mensagem =
            `${nomeRoxo} ganhou ${golsRoxo} dos cinco critérios, contra ${golsAzul} de ${nomeAzul}.`;
    } else {
        titulo = "🤝 A partida terminou empatada!";
        mensagem =
            `Cada time venceu ${golsAzul} critério(s).`;
    }

    const resultado = document.getElementById("resultado-partida");

    resultado.innerHTML = `
        <strong>${escaparHTML(titulo)}</strong>
        <span>${escaparHTML(mensagem)}</span>
    `;

    resultado.hidden = false;

    document.getElementById("status-partida").textContent = "Fim de jogo";

    document.getElementById("comentario-partida").textContent =
        `Placar final: ${nomeAzul} ${golsAzul} × ${golsRoxo} ${nomeRoxo}.`;
}

function jogarRodada() {
    if (rodada >= atributosFutebol.length) {
        finalizarPartida();
        return;
    }

    limparAnimacoes();

    const [chave, nome] = atributosFutebol[rodada];

    const a = obterAtributos(timeAzul);
    const b = obterAtributos(timeRoxo);

    rodada++;

    document.getElementById("status-partida").textContent =
        `Rodada ${rodada} de 5`;

    let vencedor = null;

    if (a[chave] > b[chave]) {
        vencedor = "one";
    } else if (b[chave] > a[chave]) {
        vencedor = "two";
    }

    let comentario;

    if (vencedor === "one") {
        comentario =
            `${nome}: ${a[chave]} contra ${b[chave]}. Gol do time azul!`;
    } else if (vencedor === "two") {
        comentario =
            `${nome}: ${b[chave]} contra ${a[chave]}. Gol do time roxo!`;
    } else {
        comentario =
            `${nome}: empate em ${a[chave]}! Ninguém marca nesta rodada.`;
    }

    document.getElementById("comentario-partida").textContent = comentario;

    const concluir = () => {
        if (vencedor === "one") {
            golsAzul++;

            document.getElementById("placar-one").textContent = golsAzul;
        }

        if (vencedor === "two") {
            golsRoxo++;

            document.getElementById("placar-two").textContent = golsRoxo;
        }

        atualizarProgresso();

        aguardar(690, jogarRodada, identificadorAnimacao);
    };

    if (vencedor) {
        animarGol(vencedor, concluir);
    } else {
        animarEmpate(concluir);
    }
}

function iniciarPartida() {
    if (!timeAzul || !timeRoxo) {
        mostrarNotificacao("Aguarde os times carregarem.");
        return;
    }

    reiniciarPartida();

    partidaAtiva = true;

    document.getElementById("iniciar-partida").disabled = true;

    jogarRodada();
}

// ==========================================
// EVENTOS
// ==========================================

elementos.formulario.addEventListener("submit", evento => {
    evento.preventDefault();

    pesquisarPokemon(elementos.pesquisa.value);
});

elementos.aleatorio.addEventListener("click", pesquisarAleatorio);

elementos.anterior.addEventListener("click", () => {
    if (paginaAtual > 1) {
        carregarPagina(paginaAtual - 1);
    }
});

elementos.proxima.addEventListener("click", () => {
    carregarPagina(paginaAtual + 1);
});

elementos.limparComparacao.addEventListener("click", () => {
    comparacao = [];
    atualizarComparacao();
    mostrarNotificacao("Comparação limpa.");
});

document.getElementById("pokemon-one").addEventListener("change", atualizarTimes);

document.getElementById("pokemon-two").addEventListener("change", atualizarTimes);

document.getElementById("iniciar-partida").addEventListener("click", iniciarPartida);

document.getElementById("reiniciar-partida").addEventListener("click", () => {
    reiniciarPartida();
    mostrarNotificacao("Partida reiniciada.");
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function iniciarAplicacao() {
    atualizarFavoritos();
    atualizarComparacao();

    await carregarListaCatalogo();
}

iniciarAplicacao();