import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { ChakraProvider } from "@chakra-ui/react"
import Navbar from './components/Navbar/Navbar';
import App from './App';

import { ContextProvider } from "./components/ContextProvider/ContextProvider";
import { RegulatorContextProvider } from "./components/Regulator/RegulatorContextProvider";
import { OperatorContextProvider } from "./components/TollBoothOperator/OperatorContextProvider";

const appTitle = "TollRoad";

ReactDOM.render(
    <React.StrictMode>
        <ChakraProvider>
            <ContextProvider>

                <RegulatorContextProvider>
                    <OperatorContextProvider>

                        <Navbar title={appTitle} />
                        <App />

                    </OperatorContextProvider>
                </RegulatorContextProvider>

            </ContextProvider>
        </ChakraProvider>
    </React.StrictMode>,
  document.getElementById('root')
);