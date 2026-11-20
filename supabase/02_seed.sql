begin;

insert into public.produtos (
  slug, nome, categoria, volume, imagem_url, varejo_centavos, atacado_centavos,
  minimo_atacado, mais_vendido, oferta_da_semana, ordem
) values
  ('brava', 'Cerveja Brava Puro Malte', 'cervejas', '330 ml', '/imagens/brava.jpg', 790, 590, 6, true, false, 1),
  ('serra-alta', 'Vinho Serra Alta Malbec', 'vinhos', '750 ml', '/imagens/serra-alta.jpg', 6490, 5590, 6, true, false, 2),
  ('oak-reserve', 'Whisky Oak Reserve', 'destilados', '750 ml', '/imagens/oak-reserve.jpg', 15990, 14290, 3, true, false, 3),
  ('monte-luar', 'Espumante Monte Luar Brut', 'vinhos', '750 ml', '/imagens/monte-luar.jpg', 6890, 5990, 6, true, false, 4),
  ('pulso', 'Energético Pulso Original', 'energeticos', '250 ml', '/imagens/pulso.jpg', 849, 690, 12, false, true, 5),
  ('viva-cola', 'Refrigerante Viva Cola', 'refrigerantes', '350 ml', '/imagens/viva-cola.jpg', 449, 359, 12, false, true, 6),
  ('dourada', 'Cerveja Dourada Lager', 'cervejas', '330 ml', '/imagens/dourada.jpg', 699, 549, 6, false, true, 7),
  ('fonte-clara', 'Água Mineral Fonte Clara', 'agua', '500 ml', '/imagens/fonte-clara.jpg', 249, 185, 12, false, true, 8),
  ('vale-verde', 'Vinho Vale Verde Sauvignon Blanc', 'vinhos', '750 ml', '/imagens/vale-verde.jpg', 5990, 4990, 6, false, false, 9)
on conflict (slug) do nothing;

commit;
