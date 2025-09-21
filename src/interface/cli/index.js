#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CasoDeUsoAnalisarRelatorioSicoob } from '../../application/CasoDeUsoAnalisarRelatorioSicoob.js';

const program = new Command();

program
  .name('sicoob-parse')
  .argument('<input>', 'Arquivo PDF do relatório')
  .option('-o, --out <arquivo>', 'Arquivo de saída JSON', 'saida.json')
  .action(async (input, opts) => {
    try {
      const inAbs = path.resolve(input);

      // valida existência do arquivo
      try {
        await fs.access(inAbs);
      } catch {
        console.error(
          'Arquivo PDF não encontrado:\n  ' +
          inAbs +
          '\nVerifique o caminho informado.'
        );
        process.exit(1);
      }

      // Valida extensão .pdf
      if (!inAbs.toLowerCase().endsWith('.pdf')) {
        console.error('Entrada inválida: espere um arquivo .pdf');
        process.exit(1);
      }

      const usecase = new CasoDeUsoAnalisarRelatorioSicoob();
      const result = await usecase.execute({ inputPath: inAbs });

      const outPath = path.resolve(opts.out);
      // garante diretório de saída
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf-8');

      console.log(`Sucesso! JSON salvo em: ${outPath}`);
    } catch (err) {
      console.error('Erro ao processar:', err?.message || err);
      process.exit(1);
    }
  });

program.parse(process.argv);
