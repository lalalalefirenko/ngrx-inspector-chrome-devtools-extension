import { NgrxActionRecord } from "../models/ngrx-action-record.model";

export function generateMockActions(): NgrxActionRecord[] {
  const now = Date.now();

  const states = {
    initial: {
      auth: {
        user: null,
        loading: false
      },
      todos: {
        list: [],
        loading: false
      }
    },

    afterLogin: {
      auth: {
        user: { id: 42, name: 'John Doe' },
        loading: false
      },
      todos: {
        list: [],
        loading: false
      }
    },

    loadingTodos: {
      auth: {
        user: { id: 42, name: 'John Doe' },
        loading: false
      },
      todos: {
        list: [],
        loading: true
      }
    },

    todosLoaded: {
      auth: {
        user: { id: 42, name: 'John Doe' },
        loading: false
      },
      todos: {
        list: [
          { id: 1, title: 'Buy milk', completed: false, details: {test: 1000} },
          { id: 2, title: 'Fix NgRx DevTools', completed: false }
        ],
        loading: false
      }
    },

    afterAddTodo: {
      auth: {
        user: { id: 42, name: 'John Doe' },
        loading: false
      },
      todos: {
        list: [
          { id: 1, title: 'Buy milk', completed: false },
          { id: 2, title: 'Fix NgRx DevTools', completed: false },
          { id: 3, title: 'Celebrate 🎉', completed: false }
        ],
        test:[1,2,3,4,5,6],
        loading: false
      }
    }
  };

  return [
    {
      id: Math.random(),
      type: '[Auth] Login',
      payload: { userId: 42 },
      state: states.initial,
      timestamp: now - 4000
    },
    {
      id: Math.random(),
      type: '[Auth] Login Success',
      payload: { user: states.afterLogin.auth.user },
      state: states.afterLogin,
      timestamp: now - 3500
    },
    {
      id: Math.random(),
      type: '[Todos] Load Todos',
      payload: null,
      state: states.loadingTodos,
      timestamp: now - 2500
    },
    {
      id: Math.random(),
      type: '[Todos] Load Todos Success',
      payload: { todos: states.todosLoaded.todos.list },
      state: states.todosLoaded,
      timestamp: now - 1500
    },
    {
      id: Math.random(),
      type: '[Todos] Add Todo',
      payload: { title: 'Celebrate 🎉' },
      state: states.afterAddTodo,
      timestamp: now - 500
    }
  ];
}
