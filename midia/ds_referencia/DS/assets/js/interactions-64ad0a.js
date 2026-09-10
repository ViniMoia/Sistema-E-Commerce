function updateMissionFilter(category) {
            const btnAll = document.getElementById('filter-all');
            const btnDeep = document.getElementById('filter-deep-space');
            const btnOrb = document.getElementById('filter-orbital');

            const cardAres = document.getElementById('card-ares');
            const cardGateway = document.getElementById('card-gateway');
            const cardTitan = document.getElementById('card-titan');
            const stackRight = document.getElementById('stack-right');

            // Reset Buttons
            const btns = [btnAll, btnDeep, btnOrb];
            btns.forEach(b => {
              b.className = 'filter-btn px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 text-white/50 hover:text-white hover:bg-white/5';
            });

            // Active Button Style
            const activeClass = 'filter-btn px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 bg-white text-neutral-950 shadow-lg shadow-white/5 scale-105';

            // Reset Cards Layout
            // Default: Ares (col-span-8), RightStack (col-span-4), RightStack > Cards (flex-1)

            if (category === 'all') {
              btnAll.className = activeClass;

              // Show all
              cardAres.style.display = 'block';
              stackRight.style.display = 'flex';
              cardGateway.style.display = 'block';
              cardTitan.style.display = 'block';

              setTimeout(() => {
                cardAres.classList.remove('opacity-0', 'scale-95', 'hidden');
                stackRight.classList.remove('opacity-0', 'scale-95', 'hidden');
                cardGateway.classList.remove('opacity-0', 'flex-[0]');
                cardTitan.classList.remove('opacity-0', 'flex-[0]');

                // Restore Layout
                stackRight.classList.remove('md:col-span-12');
                stackRight.classList.add('md:col-span-4');
                cardGateway.classList.add('flex-1');
                cardTitan.classList.add('flex-1');
              }, 50);

            } else if (category === 'deep-space') {
              btnDeep.className = activeClass;

              // Show Ares & Titan, Hide Gateway
              cardAres.style.display = 'block';
              stackRight.style.display = 'flex';
              cardTitan.style.display = 'block';

              // Hide Gateway
              cardGateway.classList.add('opacity-0', 'flex-[0]');
              setTimeout(() => { cardGateway.style.display = 'none'; }, 300);

              // Show others
              cardAres.classList.remove('opacity-0', 'scale-95', 'hidden');
              stackRight.classList.remove('opacity-0', 'scale-95', 'hidden');
              cardTitan.classList.remove('opacity-0', 'flex-[0]');

              // Layout: Same as All but Titan expands
              stackRight.classList.remove('md:col-span-12');
              stackRight.classList.add('md:col-span-4');
              cardTitan.classList.add('flex-1');

            } else if (category === 'orbital') {
              btnOrb.className = activeClass;

              // Show Gateway, Hide Ares & Titan
              cardGateway.style.display = 'block';
              stackRight.style.display = 'flex';

              // Hide others
              cardAres.classList.add('opacity-0', 'scale-95');
              cardTitan.classList.add('opacity-0', 'flex-[0]');

              setTimeout(() => {
                cardAres.style.display = 'none';
                cardTitan.style.display = 'none';
              }, 300);

              // Show Gateway
              stackRight.classList.remove('opacity-0', 'scale-95', 'hidden');
              cardGateway.classList.remove('opacity-0', 'flex-[0]');

              // Layout Change: Right Stack takes full width
              stackRight.classList.remove('md:col-span-4');
              stackRight.classList.add('md:col-span-12');
              cardGateway.classList.add('flex-1');
            }
          }