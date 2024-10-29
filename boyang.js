document.addEventListener("DOMContentLoaded", function () {
    const scatterPlot = d3.select("#scatterplot");
    const boxPlot = d3.select("#boxplot");
    const colorKey = d3.select("#color-key");
    const xAttributeDropdown = d3.select("#x-attribute");
    const yAttributeDropdown = d3.select("#y-attribute");
    const colorAttributeDropdown = d3.select("#color-attribute");
    const boxplotAttributeDropdown = d3.select("#boxplot-attribute");
    const datasetDropdown = d3.select("#dataset");
    let currentDataset;
    // Load and parse datasets
    function loadDataset(dataset) {
        let url;
        if (dataset === "penguins_cleaned") {
            url = 'penguins_cleaned.csv';
        } else if (dataset === "pokemon") {
            url = 'pokemon.csv';
        } else {
            url = `/testing/data/${dataset}.csv`; // For test datasets
        }

        d3.csv(url).then(data => {
            currentDataset = data;
            populateDropdowns(data);
            drawScatterPlot();
        });
    }

    function populateDropdowns(data) {
        // Clear the dropdowns first
        xAttributeDropdown.selectAll("option").remove();
        yAttributeDropdown.selectAll("option").remove();
        colorAttributeDropdown.selectAll("option").remove();
        boxplotAttributeDropdown.selectAll("option").remove();

        const columns = Object.keys(data[0]);

        const quantitativeAttributes = columns.filter(col => data.every(d => !isNaN(+d[col])) && col !== "#" && col !== "Name");
        const categoricalAttributes = columns.filter(col => !quantitativeAttributes.includes(col));

        // Populate quantitative dropdowns
        quantitativeAttributes.forEach(attr => {
            xAttributeDropdown.append("option").text(attr).attr("value", attr);
            yAttributeDropdown.append("option").text(attr).attr("value", attr);
            boxplotAttributeDropdown.append("option").text(attr).attr("value", attr);
        });

        // Populate categorical dropdowns
        categoricalAttributes.forEach(attr => {
            colorAttributeDropdown.append("option").text(attr).attr("value", attr);
        });
    }

    function drawScatterPlot() {
        const xAttr = xAttributeDropdown.property("value");
        const yAttr = yAttributeDropdown.property("value");
        const colorAttr = colorAttributeDropdown.property("value");

        scatterPlot.select("svg").remove();

        const width = 600;
        const height = 400;
        const svg = scatterPlot.append("svg").attr("width", width).attr("height", height);
        const xScale = d3.scaleLinear().domain([d3.min(currentDataset, d => +d[xAttr]), d3.max(currentDataset, d => +d[xAttr])]).range([50, width - 50]);
        const yScale = d3.scaleLinear().domain([d3.min(currentDataset, d => +d[yAttr]), d3.max(currentDataset, d => +d[yAttr])]).range([height - 50, 50]);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        svg.append("g").attr("transform", `translate(0,${height - 50})`).call(d3.axisBottom(xScale));
        svg.append("g").attr("transform", `translate(50,0)`).call(d3.axisLeft(yScale));
        const points = svg.selectAll("circle").data(currentDataset).enter().append("circle")
            .attr("cx", d => xScale(d[xAttr]))
            .attr("cy", d => yScale(d[yAttr]))
            .attr("r", 5)
            .attr("fill", d => colorScale(d[colorAttr]));

        drawColorKey(colorAttr, colorScale);
        setupLasso(points);
    }

    function drawColorKey(colorAttr, colorScale) {
        colorKey.html("");
        const uniqueValues = Array.from(new Set(currentDataset.map(d => d[colorAttr])));
        uniqueValues.forEach(value => {
            const colorBox = colorKey.append("div").attr("class", "color-box");
            colorBox.append("div")
                .attr("class", "color-square")
                .style("background-color", colorScale(value));
            colorBox.append("span").text(value);
        });
    }

    function setupLasso(points) {
        const lasso = d3.lasso()
            .closePathSelect(true)
            .items(points)
            .targetArea(d3.select("svg"))
            .on("start", () => { points.classed("not_selected", true).classed("selected", false); })
            .on("draw", () => {
                lasso.possibleItems().classed("not_selected", false).classed("selected", true);
                lasso.notPossibleItems().classed("not_selected", true).classed("selected", false);
            })
            .on("end", () => {
                const selectedData = lasso.selectedItems().data();
                if (selectedData.length > 0) {
                    drawBoxPlot(selectedData);
                    updateSelectionCount(selectedData.length);
                } else {
                    drawBoxPlot([]);  // Clear box plot if no selection
                }
            });
        d3.select("svg").call(lasso);
        d3.select("svg").on("click", () => { points.classed("not_selected", false).classed("selected", false); drawBoxPlot([]); });
    }

    function drawBoxPlot(selectedData) {
        // Clear the existing box plot
        boxPlot.select("svg").remove();
        
        // Get the selected attribute for the box plot
        const boxAttr = boxplotAttributeDropdown.property("value");
        const colorAttr = colorAttributeDropdown.property("value");
        
        // Check if any data is selected
        if (selectedData.length === 0) {
            console.log("No data selected, clearing box plot.");
            return; // If no data is selected, exit
        }
        
        // Log selected data for debugging
        console.log("Selected Data for Box Plot:", selectedData);
        
        // Set up SVG dimensions
        const width = 600;
        const height = 400;
        const svg = boxPlot.append("svg").attr("width", width).attr("height", height);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        
        // Group data by the selected color attribute
        const groupedData = d3.group(selectedData, d => d[colorAttr]);
        const groups = Array.from(groupedData.keys());
        console.log("Groups in Box Plot:", groups); // Log the groups for debugging
        const boxWidth = width / groups.length - 20;
        
        // Calculate overall min and max for scaling
        const allValues = selectedData.map(d => +d[boxAttr]);
        const yScale = d3.scaleLinear()
            .domain([d3.min(allValues), d3.max(allValues)])
            .range([height - 50, 50]);
        
        // Draw Y axis
        svg.append("g").attr("transform", `translate(50, 0)`).call(d3.axisLeft(yScale));
        
        // Draw a box plot for each group
        groups.forEach((group, i) => {
            const data = groupedData.get(group).map(d => +d[boxAttr]).sort(d3.ascending);
            
            // Check if the group has enough points for a meaningful box plot
            if (data.length < 5) {
                console.log(`Group ${group} has fewer than 5 points, displaying points instead of box plot.`);
                data.forEach(value => {
                    svg.append("circle")
                        .attr("cx", i * boxWidth + 80)
                        .attr("cy", yScale(value))
                        .attr("r", 4)
                        .attr("fill", colorScale(group));
                });
                return;
            }
            
            // Calculate box plot statistics
            const [min, q1, median, q3, max] = [
                d3.min(data),
                d3.quantile(data, 0.25),
                d3.median(data),
                d3.quantile(data, 0.75),
                d3.max(data)
            ];
            
            console.log(`Box plot stats for group ${group}:`, { min, q1, median, q3, max }); // Log box plot stats
            
            const g = svg.append("g").attr("transform", `translate(${i * boxWidth + 80}, 0)`);
            
            // Draw box for Q1 to Q3
            g.append("rect")
                .attr("x", -boxWidth / 4)
                .attr("width", boxWidth / 2)
                .attr("y", yScale(q3))
                .attr("height", yScale(q1) - yScale(q3))
                .attr("fill", colorScale(group))
                .attr("opacity", 0.7);
            
            // Draw whiskers for min to Q1 and Q3 to max
            g.append("line").attr("x1", 0).attr("x2", 0)
                .attr("y1", yScale(min)).attr("y2", yScale(q1))
                .attr("stroke", "black");
            g.append("line").attr("x1", 0).attr("x2", 0)
                .attr("y1", yScale(q3)).attr("y2", yScale(max))
                .attr("stroke", "black");
            
            // Draw median line
            g.append("line").attr("x1", -boxWidth / 4).attr("x2", boxWidth / 4)
                .attr("y1", yScale(median)).attr("y2", yScale(median))
                .attr("stroke", "black");
            
            // Add group label under the box plot
            g.append("text")
                .attr("y", height - 30)
                .attr("x", -boxWidth / 4)
                .attr("text-anchor", "middle")
                .text(group);
        });
    }
    
    

    function updateSelectionCount(count) {
        d3.select(".selection-count").remove();
        scatterPlot.append("div").attr("class", "selection-count").text(`Selected Points: ${count}`);
    }

    datasetDropdown.on("change", () => loadDataset(datasetDropdown.property("value")));
    xAttributeDropdown.on("change", drawScatterPlot);
    yAttributeDropdown.on("change", drawScatterPlot);
    colorAttributeDropdown.on("change", drawScatterPlot);
    boxplotAttributeDropdown.on("change", () => drawBoxPlot([]));

    loadDataset("penguins_cleaned");
});
