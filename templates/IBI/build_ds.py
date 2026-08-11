import os
from bs4 import BeautifulSoup

def main():
    filepath = 'index.html'
    output_path = 'design-system.html'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract head
    head = soup.head
    
    # Extract body attributes
    body_attrs = soup.body.attrs
    
    # Extract Hero (we'll capture the #cabeVitrine element as the hero)
    cabe_vitrine = soup.find(id='cabeVitrine')
    
    # We will clone it
    if cabe_vitrine:
        # Clone header
        hero_clone = BeautifulSoup(str(cabe_vitrine), 'html.parser').div
        # Find the text node to replace "Conquiste grandes resultados! Vem ser um de nossos parceiros de sucesso."
        text_node = hero_clone.find('div', class_='text-cinza60')
        if text_node and text_node.p:
            text_node.p.string = "Welcome to the Design System! Explore our living pattern library and components, maintaining exactly the same layout and hierarchy."
    else:
        hero_clone = "<div>Hero not found</div>"

    # Grab some examples for Typography 
    # Typography section
    typography_html = """
    <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto;" id="typography">
        <div class="vdzp-vitrine-titulo mb-5" style="border-bottom: 2px solid var(--cinza30); padding-bottom: 10px;">Typography</div>
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--cinza30);">
                <div style="width: 20%; color: var(--cinza60); font-size: 14px;"><strong>Heading 1</strong></div>
                <div style="width: 60%;"><div class="vdzp-vitrine-titulo"><h1 style="margin:0;">Sample Heading 1</h1></div></div>
                <div style="width: 20%; text-align: right; color: var(--cinza45);">24px / 1.2</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--cinza30);">
                <div style="width: 20%; color: var(--cinza60); font-size: 14px;"><strong>Bold L</strong></div>
                <div style="width: 60%;"><span class="vdzp-vitrine-titulo lh-1 text-cinza100 bold">R$156,00</span></div>
                <div style="width: 20%; text-align: right; color: var(--cinza45);">16px / 1</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--cinza30);">
                <div style="width: 20%; color: var(--cinza60); font-size: 14px;"><strong>Bold M</strong></div>
                <div style="width: 60%;"><div class="descricao-produto semi-bold line-clamp-2">PCT 12 UN. CAMISA ADIDAS BRASIL</div></div>
                <div style="width: 20%; text-align: right; color: var(--cinza45);">14px / 1.2</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--cinza30);">
                <div style="width: 20%; color: var(--cinza60); font-size: 14px;"><strong>Paragraph</strong></div>
                <div style="width: 60%;"><div class="text-cinza60 fonte-grande text-break-word"><p style="margin:0;">Conquiste grandes resultados! Vem ser um de nossos parceiros de sucesso.</p></div></div>
                <div style="width: 20%; text-align: right; color: var(--cinza45);">16px / 1.5</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--cinza30);">
                <div style="width: 20%; color: var(--cinza60); font-size: 14px;"><strong>Regular M</strong></div>
                <div style="width: 60%;"><div class="descricao-categoria-carrossel mt-1"><span>CAMISA </span></div></div>
                <div style="width: 20%; text-align: right; color: var(--cinza45);">12px / 1.2</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--cinza30);">
                <div style="width: 20%; color: var(--cinza60); font-size: 14px;"><strong>Regular S</strong></div>
                <div style="width: 60%;"><div class="text-cinza75 fonte-media mr-2">Ordenar:</div></div>
                <div style="width: 20%; text-align: right; color: var(--cinza45);">14px / 1.2</div>
            </div>
        </div>
    </div>
    """

    # Colors
    colors_html = """
    <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto;" id="colors">
        <div class="vdzp-vitrine-titulo mb-5" style="border-bottom: 2px solid var(--cinza30); padding-bottom: 10px;">Colors & Surfaces</div>
        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--roxo); border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></div>
                <div class="vdzp-vitrine-texto bold">Primary (Roxo)</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--vendizapPrimary); border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></div>
                <div class="vdzp-vitrine-texto bold">Vendizap Primary</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--vendizapSecondary); border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></div>
                <div class="vdzp-vitrine-texto bold">Vendizap Secondary</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--cinza100); border-radius: 12px;"></div>
                <div class="vdzp-vitrine-texto bold">Cinza 100</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--cinza75); border-radius: 12px;"></div>
                <div class="vdzp-vitrine-texto bold">Cinza 75</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--cinza60); border-radius: 12px;"></div>
                <div class="vdzp-vitrine-texto bold">Cinza 60</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--cinza45); border-radius: 12px;"></div>
                <div class="vdzp-vitrine-texto bold">Cinza 45</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--cinza30); border-radius: 12px; border: 1px solid #ddd;"></div>
                <div class="vdzp-vitrine-texto bold">Cinza 30</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div style="width: 100px; height: 100px; background: var(--branco); border-radius: 12px; border: 1px solid #ddd;"></div>
                <div class="vdzp-vitrine-texto bold">Branco</div>
            </div>
            
            <div style="display: flex; flex-direction: column; width: 150px; gap: 10px;">
                <div class="card-destaque height-card-destaque" style="width: 100px; height: 100px; border-radius: 12px; margin: 0;"></div>
                <div class="vdzp-vitrine-texto bold">Card Destaque bg</div>
            </div>
        </div>
    </div>
    """

    # UI Components
    components_html = """
    <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto;" id="components">
        <div class="vdzp-vitrine-titulo mb-5" style="border-bottom: 2px solid var(--cinza30); padding-bottom: 10px;">UI Components</div>
        
        <div style="display: flex; flex-direction: column; gap: 40px;">
            
            <div>
                <h3 class="fonte-grande bold mb-3">Buttons</h3>
                <div style="display: flex; gap: 30px; align-items: flex-end; flex-wrap: wrap;">
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        <span class="text-cinza60">Default Primary</span>
                        <div class="cursor-pointer inline-flex padrao vitrine-bg-color-primary">
                            <div class="semi-bold">Comprar</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        <span class="text-cinza60">Esgotado (Disabled)</span>
                        <div class="cursor-pointer inline-flex padrao cinza35 vitrine-bg-color-primary">
                            <div class="semi-bold">Esgotado</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        <span class="text-cinza60">Category Nav Link</span>
                        <div class="cursor-pointer" style="display: inline-block;">
                            <div class="bloco-categoria py-2">
                                <img class="imagem-circulo-categoria" src="assets/d06222ca75882e8954b46cb6462e9a_a0c561b67da2.webp"/>
                                <div class="descricao-categoria-carrossel mt-1"><span>CAMISA</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        <span class="text-cinza60">Home Icon Button</span>
                        <div class="cursor-pointer" style="display: inline-block;">
                            <div class="bloco-categoria bloco-categoria-add py-2">
                                <div class="imagem-circulo-categoria-adicionar flex-center-center cinza25">
                                    <svg aria-hidden="true" class="vitrine-color-primary svg-inline--fa fa-house fa-3x" data-icon="house" data-prefix="fal" focusable="false" role="img" viewbox="0 0 576 512" xmlns="http://www.w3.org/2000/svg"><path d="M298.6 4c-6-5.3-15.1-5.3-21.2 0L5.4 244c-6.6 5.8-7.3 16-1.4 22.6s16 7.3 22.6 1.4L64 235V432c0 44.2 35.8 80 80 80H432c44.2 0 80-35.8 80-80V235l37.4 33c6.6 5.8 16.7 5.2 22.6-1.4s5.2-16.7-1.4-22.6L298.6 4zM96 432V206.7L288 37.3 480 206.7V432c0 26.5-21.5 48-48 48H368V320c0-17.7-14.3-32-32-32H240c-17.7 0-32 14.3-32 32V480H144c-26.5 0-48-21.5-48-48zm144 48V320h96V480H240z" fill="currentColor"></path></svg>
                                </div>
                                <div class="text-center vdzp-texto-pequeno descricao-categoria-carrossel mt-1">Página<br/>Inicial</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 class="fonte-grande bold mb-3">Inputs</h3>
                <div style="display: flex; gap: 30px; align-items: flex-end; flex-wrap: wrap;">
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; width: 300px;">
                        <span class="text-cinza60">Search Bar</span>
                        <div class="el-input el-input-group el-input-group--append el-input--suffix input-vdzp">
                            <input autocomplete="off" class="el-input__inner" focusable="true" placeholder="Faça sua busca" tabindex="-1" type="text">
                            <span class="el-input__suffix" style="transform: translateX(-0px);">
                            </span>
                            <div class="el-input-group__append">
                                <div class="mr-1">
                                    <div class="inline-flex align-center">
                                        <div class="botao-pesquisa">
                                            <svg aria-hidden="true" class="fonte-grande cursor-pointer svg-inline--fa fa-magnifying-glass" data-icon="magnifying-glass" data-prefix="fas" focusable="false" role="img" viewbox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" fill="currentColor"></path></svg>
                                        </div>
                                        <div class="ml-3 botao-filtro relative">
                                            <svg aria-hidden="true" class="fonte-grande cursor-pointer svg-inline--fa fa-sliders" data-icon="sliders" data-prefix="fas" focusable="false" role="img" viewbox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M0 416c0 17.7 14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32-80c-32.8 0-61 19.7-73.3 48L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm73.3-64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64z" fill="currentColor"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 class="fonte-grande bold mb-3">Cards</h3>
                <div style="display: flex; gap: 30px; flex-wrap: wrap;">
                    <div style="display: flex; flex-direction: column; gap: 10px; width: fit-content; max-width: 155px;">
                        <span class="text-cinza60">Destaque Card</span>
                        <div class="card-destaque height-card-destaque">
                            <div class="div-imagem-destaque relative">
                                <div>
                                    <div class="cursor-pointer inline-flex padrao vitrine-bg-color-primary padrao_destaque">
                                        <div class="semi-bold">Comprar</div>
                                    </div>
                                </div>
                                <img class="img-produto-destaque" src="assets/63d15e6f073601ea1019d0b1208919_cfb4ce1b6856.webp"/>
                            </div>
                            <div class="div-info-destaque cursor-pointer">
                                <div class="descricao-produto semi-bold line-clamp-2">PCT 09 UN. CONJ. COPA MASCULINO</div>
                                <div class="flex-column">
                                    <span><span class="vdzp-vitrine-titulo lh-1 text-cinza75 bold">R$207,00</span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; width: fit-content; max-width: 250px;">
                        <span class="text-cinza60">Product Card (Vitrine)</span>
                        <div class="col-produto-vitrine" style="width: auto !important; height: auto !important; max-width: 200px;">
                            <div>
                                <div class="produto-vitrine">
                                    <div class="container-imagem">
                                        <img class="imagem-produto-vitrine cursor-pointer" src="assets/451cecb799c87ed39dad3328ce491b_b43f12cd158b.webp"/>
                                    </div>
                                    <div class="detalhes-produto-vitrine mt-3">
                                        <div class="vdzp-vitrine-texto descricao line-clamp-2 mb-1">PCT 12 UN. CAMISA ADIDAS MAX</div>
                                        <div class="flex-column preco">
                                            <span><span class="vdzp-vitrine-titulo lh-1 text-cinza100 bold">R$156,00</span></span>
                                        </div>
                                        <div class="mt-2">
                                            <div class="cursor-pointer inline-flex padrao vitrine-bg-color-primary">
                                                <div class="semi-bold">Comprar</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
        </div>
    </div>
    """

    layout_html = """
    <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto;" id="layout">
        <div class="vdzp-vitrine-titulo mb-5" style="border-bottom: 2px solid var(--cinza30); padding-bottom: 10px;">Layout & Spacing</div>
        <p class="text-cinza60 mb-5">A library of standard layout containers from the App.</p>
        
        <h3 class="fonte-grande bold mb-3">Container Vitrine (px-5 margem-elementos-vitrine)</h3>
        <div style="border: 1px dashed var(--vendizapPrimary); padding: 20px; box-sizing: border-box; width: 100%; border-radius: 8px; margin-bottom: 30px;">
            <div class="px-5 margem-elementos-vitrine" style="background: rgba(0,0,0,0.05); padding-top: 10px; padding-bottom: 10px;">
                Content inside container
            </div>
            <div style="width: 100%; display: flex; justify-content: space-between; font-size: 12px; color: var(--cinza45); margin-top: 5px;">
                <span>Container: Left/Right padding</span>
            </div>
        </div>

        <h3 class="fonte-grande bold mb-3">Flex row with space-between</h3>
        <div style="border: 1px dashed var(--vendizapPrimary); padding: 20px; box-sizing: border-box; width: 100%; border-radius: 8px;">
            <div class="align-center justify-space-between" style="background: rgba(0,0,0,0.05);">
                <div class="vdzp-vitrine-titulo">Left Title</div>
                <div class="align-center">Right Content</div>
            </div>
        </div>
    </div>
    """

    motion_html = """
    <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto;" id="motion">
        <div class="vdzp-vitrine-titulo mb-5" style="border-bottom: 2px solid var(--cinza30); padding-bottom: 10px;">Motion & Interaction</div>
        <p class="text-cinza60 mb-5">Hover over items to see interactions.</p>
        
        <div style="display: flex; gap: 50px;">
            <div>
                <h4 class="bold mb-3">Product Image Hover (.imagem-produto-vitrine)</h4>
                <div class="container-imagem" style="max-width: 200px;">
                    <img class="imagem-produto-vitrine cursor-pointer" src="assets/451cecb799c87ed39dad3328ce491b_b43f12cd158b.webp"/>
                </div>
            </div>
            
            <div>
                <h4 class="bold mb-3">Icon Transform Transition</h4>
                <div class="cursor-pointer align-center column-flex" style="display: inline-flex;">
                    <svg aria-hidden="true" class="vitrine-color-primary svg-inline--fa fa-circle-info fonte-super-grande" data-icon="circle-info" data-prefix="far" focusable="false" role="img" viewbox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-88c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l24 0 0 64-24 0zm40-144a32 32 0 1 0 0-64 32 32 0 1 0 0 64z" fill="currentColor"></path></svg>
                </div>
            </div>

            <div>
                <h4 class="bold mb-3">Slide Component Reveal</h4>
                <p class="text-cinza60">Slide animations are handled by vueperslides plugin CSS inside Hero section overhead.</p>
            </div>
            
        </div>
    </div>
    """

    icons_html = """
    <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto; padding-bottom: 100px;" id="icons">
        <div class="vdzp-vitrine-titulo mb-5" style="border-bottom: 2px solid var(--cinza30); padding-bottom: 10px;">Icons</div>
        
        <div style="display: flex; gap: 30px; font-size: 24px; color: var(--cinza100);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <svg aria-hidden="true" class="fa-2x svg-inline--fa fa-cart-shopping" data-icon="cart-shopping" data-prefix="far" focusable="false" role="img" viewbox="0 0 576 512" xmlns="http://www.w3.org/2000/svg"><path d="M24 0C10.7 0 0 10.7 0 24S10.7 48 24 48l45.5 0c3.8 0 7.1 2.7 7.9 6.5l51.6 271c6.5 34 36.2 58.5 70.7 58.5L488 384c13.3 0 24-10.7 24-24s-10.7-24-24-24l-288.3 0c-11.5 0-21.4-8.2-23.6-19.5L170.7 288l288.5 0c32.6 0 61.1-21.8 69.5-53.3l41-152.3C576.6 57 557.4 32 531.1 32l-411 0C111 12.8 91.6 0 69.5 0L24 0zM131.1 80l389.6 0L482.4 222.2c-2.8 10.5-12.3 17.8-23.2 17.8l-297.6 0L131.1 80zM176 512a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm336-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z" fill="currentColor"></path></svg>
                <div class="text-cinza60" style="font-size: 12px;">fa-cart-shopping</div>
            </div>
            
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <svg aria-hidden="true" class="svg-inline--fa fa-circle-info fa-2x" data-icon="circle-info" data-prefix="far" focusable="false" role="img" viewbox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-88c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l24 0 0 64-24 0zm40-144a32 32 0 1 0 0-64 32 32 0 1 0 0 64z" fill="currentColor"></path></svg>
                <div class="text-cinza60" style="font-size: 12px;">fa-circle-info</div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <svg aria-hidden="true" class="fa-2x svg-inline--fa fa-bars" data-icon="bars" data-prefix="fas" focusable="false" role="img" viewbox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z" fill="currentColor"></path></svg>
                <div class="text-cinza60" style="font-size: 12px;">fa-bars</div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <svg aria-hidden="true" class="svg-inline--fa fa-house fa-2x" data-icon="house" data-prefix="fal" focusable="false" role="img" viewbox="0 0 576 512" xmlns="http://www.w3.org/2000/svg"><path d="M298.6 4c-6-5.3-15.1-5.3-21.2 0L5.4 244c-6.6 5.8-7.3 16-1.4 22.6s16 7.3 22.6 1.4L64 235V432c0 44.2 35.8 80 80 80H432c44.2 0 80-35.8 80-80V235l37.4 33c6.6 5.8 16.7 5.2 22.6-1.4s5.2-16.7-1.4-22.6L298.6 4zM96 432V206.7L288 37.3 480 206.7V432c0 26.5-21.5 48-48 48H368V320c0-17.7-14.3-32-32-32H240c-17.7 0-32 14.3-32 32V480H144c-26.5 0-48-21.5-48-48zm144 48V320h96V480H240z" fill="currentColor"></path></svg>
                <div class="text-cinza60" style="font-size: 12px;">fa-house</div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <svg aria-hidden="true" class="fa-2x svg-inline--fa fa-sliders" data-icon="sliders" data-prefix="fas" focusable="false" role="img" viewbox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M0 416c0 17.7 14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32-80c-32.8 0-61 19.7-73.3 48L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm73.3-64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64z" fill="currentColor"></path></svg>
                <div class="text-cinza60" style="font-size: 12px;">fa-sliders</div>
            </div>
            
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <svg aria-hidden="true" class="fa-2x svg-inline--fa fa-magnifying-glass" data-icon="magnifying-glass" data-prefix="fas" focusable="false" role="img" viewbox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" fill="currentColor"></path></svg>
                <div class="text-cinza60" style="font-size: 12px;">fa-magnifying-glass</div>
            </div>
        </div>
    </div>
    """

    final_html = f"""<!DOCTYPE html>
<html class="scroll-cinza-thin" lang="pt-br" style="background: rgb(255, 255, 255); --vh: 10.8px; scroll-behavior: smooth;">
<head>
{head.decode_contents()}
<style>
/* Smooth scrolling */
html {{
  scroll-behavior: smooth;
}}

/* Sticky nav */
nav.ds-nav {{
  position: sticky;
  top: 0;
  z-index: 9999;
  background: white;
  display: flex;
  justify-content: center;
  gap: 30px;
  padding: 15px 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-bottom: 1px solid var(--cinza30);
}}

nav.ds-nav a {{
  color: var(--cinza100);
  font-weight: bold;
  text-decoration: none;
  font-size: 16px;
  transition: color 0.2s;
}}

nav.ds-nav a:hover {{
  color: var(--vendizapSecondary);
}}

/* Section spacing */
section {{
  scroll-margin-top: 80px; 
}}

/* Design System specific styles overrides if needed */
.ds-container {{
  max-width: 1200px;
  margin: 0 auto;
}}
</style>
</head>
<body {' '.join([f'{k}="{v}"' for k,v in body_attrs.items()])}>

<nav class="ds-nav">
  <a href="#hero">Hero</a>
  <a href="#typography">Typography</a>
  <a href="#colors">Colors</a>
  <a href="#components">Components</a>
  <a href="#layout">Layout</a>
  <a href="#motion">Motion</a>
  <a href="#icons">Icons</a>
</nav>

<main style="padding-bottom: 0;">
    <section id="hero" style="padding-bottom: 50px; border-bottom: 1px dashed var(--cinza45);">
        <div style="padding: 20px; text-align: center; background: rgba(0,0,0,0.02); margin-bottom: 20px;">
           <span class="text-cinza60">Hero Original Clone</span>
        </div>
        {str(hero_clone)}
    </section>

    <section id="typography">
        {typography_html}
    </section>

    <section id="colors">
        {colors_html}
    </section>

    <section id="components">
        {components_html}
    </section>

    <section id="layout">
        {layout_html}
    </section>

    <section id="motion">
        {motion_html}
    </section>

    <section id="icons">
        {icons_html}
    </section>
</main>

<script>
// We can re-trigger animations or any minor initialization if needed.
// Vueperslides is probably managed by the app js, which is loaded asynchronously.
</script>
</body>
</html>
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)

if __name__ == '__main__':
    main()
