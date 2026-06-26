import sqlite3
import tkinter as tk
from datetime import date

def criar_tabela():
    conexao = sqlite3.connect("chamada.db")
    cursor = conexao.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS chamada (nome TEXT, data TEXT, presente INTEGER)")
    conexao.commit()
    conexao.close()

def salvar_chamada():
    nome = entry_nome.get()
    presente = var_presente.get()
    data = str(date.today())
    conexao = sqlite3.connect("chamada.db")
    cursor = conexao.cursor()
    cursor.execute("INSERT INTO chamada (nome, data, presente) VALUES (?, ?, ?)", (nome, data, presente))
    conexao.commit()
    conexao.close()

criar_tabela()

janela = tk.Tk()
janela.title("Chamada da Sala")

tk.Label(janela, text="Nome do aluno:").pack()

entry_nome = tk.Entry(janela)
entry_nome.pack()

var_presente = tk.IntVar()
tk.Checkbutton(janela, text="Presente", variable=var_presente).pack()

tk.Button(janela, text="Salvar chamada", command=salvar_chamada).pack()

janela.mainloop()